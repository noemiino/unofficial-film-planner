// Simple backend server for Notion API proxy
// Following Gail's Law: Start simple, build complexity incrementally

const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3001;

// Simple file-based storage for shared schedules
// In production, you'd want to use a proper database, but this works for now
const SHARES_FILE = path.join(__dirname, 'shares.json');

// Load existing shares from file (or create empty object)
let sharedSchedules = {};
try {
    if (fs.existsSync(SHARES_FILE)) {
        sharedSchedules = JSON.parse(fs.readFileSync(SHARES_FILE, 'utf8'));
    }
} catch (error) {
    console.error('Error loading shares file:', error);
    sharedSchedules = {};
}

// Save shares to file
function saveShares() {
    try {
        fs.writeFileSync(SHARES_FILE, JSON.stringify(sharedSchedules, null, 2));
    } catch (error) {
        console.error('Error saving shares file:', error);
    }
}

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Serve static files (HTML, CSS, JS) from the current directory
app.use(express.static(__dirname));

// Explicit route for root to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Notion API proxy endpoint
app.post('/api/notion/query', async (req, res) => {
    try {
        const { databaseId, apiKey } = req.body;
        
        if (!databaseId || !apiKey) {
            return res.status(400).json({ error: 'Missing databaseId or apiKey' });
        }

        const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                page_size: 100
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Notion API error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test connection endpoint
app.post('/api/notion/test', async (req, res) => {
    try {
        const { databaseId, apiKey } = req.body;
        
        if (!databaseId || !apiKey) {
            return res.status(400).json({ error: 'Missing databaseId or apiKey' });
        }

        const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Notion-Version': '2022-06-28'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Notion API error:', error);
        res.status(500).json({ error: error.message });
    }
});

// IFFR link parser endpoint
app.post('/api/iffr/parse', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'Missing URL' });
        }

        // Fetch the IFFR page
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch IFFR page: ${response.status}`);
        }

        const html = await response.text();
        
        // Detect if this is an event/programme page (not an individual film page)
        const isEventPage = url.includes('/events/');
        
        // Extract title - look for h1 tag with font-heading class (first row)
        const titleMatch = html.match(/<h1[^>]*class="[^"]*font-heading[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
                            html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || 
                            html.match(/<title>([^<]+)<\/title>/i);
        let title = titleMatch ? titleMatch[1].trim() : 'Unknown Film';
        // Clean up title (remove "| IFFR 2026" etc.)
        title = title.replace(/\s*\|\s*IFFR.*$/i, '').trim();
        
        // For event pages, the title is the programme name, not a film title
        // We'll handle this differently below

        // Extract director - look for <a> tag with underline class linking to /person/ (second row, underlined name)
        const directorMatch = html.match(/<a[^>]*class="[^"]*underline[^"]*"[^>]*href="[^"]*\/person\/[^"]*"[^>]*>([^<]+)<\/a>/i) ||
                             html.match(/<a[^>]*href="[^"]*\/person\/[^"]*"[^>]*>([^<]+)<\/a>/i);
        const director = directorMatch ? directorMatch[1].trim() : '';

        // Extract countries - look for spans with whitespace-nowrap class after director (second row, after director)
        // Countries are in format: <span class="whitespace-nowrap">Country</span> separated by commas
        let countries = '';
        const countryMatches = html.match(/<span[^>]*class="[^"]*whitespace-nowrap[^"]*"[^>]*>([^<]+)<\/span>/gi);
        if (countryMatches) {
            const countryList = countryMatches.map(m => {
                const match = m.match(/<span[^>]*class="[^"]*whitespace-nowrap[^"]*"[^>]*>([^<]+)<\/span>/i);
                return match ? match[1].trim() : '';
            }).filter(c => c && !c.match(/^\d{4}$/) && !c.match(/^\d+'$/)); // Filter out year and length
            // Remove duplicates while preserving order
            const uniqueCountries = [...new Set(countryList)];
            countries = uniqueCountries.join(', ');
        }
        
        // Fallback: try "Countries of production" section
        if (!countries) {
            const countriesMatch = html.match(/Countries of production[^<]*<[^>]*>([^<]+)</i) ||
                                          html.match(/Countries of production[^>]*>([^<]+)</i);
            countries = countriesMatch ? countriesMatch[1].trim() : '';
        }

        // Extract programme - look for <a> tag with "absolute-link" class (the programme link button)
        const programmeMatch = html.match(/<a[^>]*href="[^"]*\/[^"]*"[^>]*class="[^"]*absolute-link[^"]*"[^>]*>([^<]+)<\/a>/i) ||
                               html.match(/<a[^>]*class="[^"]*absolute-link[^"]*"[^>]*>([^<]+)<\/a>/i);
        const programme = programmeMatch ? programmeMatch[1].trim() : '';

        // Extract screenings using cheerio - simple, robust DOM parsing
        const screenings = [];
        const $ = cheerio.load(html);
        
        // Support both English and Dutch month names
        const monthMap = {
            // English
            'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
            'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11,
            // Dutch
            'januari': 0, 'februari': 1, 'maart': 2, 'april': 3, 'mei': 4, 'juni': 5,
            'juli': 6, 'augustus': 7, 'september': 8, 'oktober': 9, 'november': 10, 'december': 11
        };
        
        // Find all <li> elements that contain a <time> tag (these are screenings)
        const allLis = $('li');
        console.log(`Total <li> elements found: ${allLis.length}`);
        
        // Try to find screenings in the specific container first
        const screeningsContainer = $('ul.flex.flex-col.gap-2, ul[class*="flex"][class*="flex-col"]');
        const screeningsLis = screeningsContainer.length > 0 ? screeningsContainer.find('li') : allLis;
        console.log(`Screenings container found: ${screeningsContainer.length}, screenings <li> elements: ${screeningsLis.length}`);
        
        screeningsLis.each((index, element) => {
            if (screenings.length >= 20) return false; // Stop after 20 screenings
            
            const $li = $(element);
            const $time = $li.find('time[datetime]').first();
            
            // Skip if no time tag found
            if ($time.length === 0) {
                if (index < 5) console.log(`Skipping <li> ${index + 1}: no time[datetime] found`);
                return;
            }
            
            try {
                // Extract time from <time> tag
                const timeText = $time.text().trim(); // "Saturday 31 January 2026 | 18.30 - 20.03" or "zaterdag 31 januari 2026 | 19.45 - 22.57"
                const datetimeAttr = $time.attr('datetime'); // "2026-01-31 18:30" or "2026-01-31 19:45"
                
                // Use datetime attribute as primary source (more reliable than parsing text)
                let startDate, endDate;
                
                if (datetimeAttr) {
                    // Parse datetime attribute: "2026-01-31 19:45"
                    // IFFR times are in Amsterdam timezone (CET = UTC+1 for Jan-Feb)
                    const datetimeMatch = datetimeAttr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
                    if (datetimeMatch) {
                        const [, year, month, day, hour, minute] = datetimeMatch;
                        // Create ISO string with Amsterdam timezone (+01:00 for CET)
                        const isoString = `${year}-${month}-${day}T${hour}:${minute}:00+01:00`;
                        startDate = new Date(isoString);
                    }
                }
                
                // Parse end time from text: "19.45 - 22.57" or "18.30 - 20.03"
                // Support both English and Dutch day/month names for fallback
                const timePattern = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Maandag|Dinsdag|Woensdag|Donderdag|Vrijdag|Zaterdag|Zondag)\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})\s*\|\s*(\d{1,2})\.(\d{2})\s*-\s*(\d{1,2})\.(\d{2})/i;
                const timeMatch = timeText.match(timePattern);
                
                if (timeMatch) {
                    const [, day, date, month, year, startHour, startMin, endHour, endMin] = timeMatch;
                    const monthIndex = monthMap[month.toLowerCase()];
                    if (monthIndex !== undefined) {
                        // IFFR times are in Amsterdam timezone (CET = UTC+1 for Jan-Feb)
                        const monthStr = String(monthIndex + 1).padStart(2, '0');
                        const dateStr = String(parseInt(date)).padStart(2, '0');
                        const startHourStr = String(parseInt(startHour)).padStart(2, '0');
                        const startMinStr = String(parseInt(startMin)).padStart(2, '0');
                        const endHourStr = String(parseInt(endHour)).padStart(2, '0');
                        const endMinStr = String(parseInt(endMin)).padStart(2, '0');
                        
                        // Use parsed text if datetime attr failed or as validation
                        if (!startDate) {
                            const startIsoString = `${year}-${monthStr}-${dateStr}T${startHourStr}:${startMinStr}:00+01:00`;
                            startDate = new Date(startIsoString);
                        }
                        const endIsoString = `${year}-${monthStr}-${dateStr}T${endHourStr}:${endMinStr}:00+01:00`;
                        endDate = new Date(endIsoString);
                    }
                } else if (!startDate) {
                    // Fallback: if both datetime attr and text parsing failed, log and skip
                    console.log(`Screening ${index + 1}: Could not parse time text: ${timeText}, datetime: ${datetimeAttr}`);
                    return;
                }
                
                // If we have startDate from datetime but no endDate, try to parse just the end time
                if (startDate && !endDate) {
                    const endTimeMatch = timeText.match(/\|\s*\d{1,2}\.\d{2}\s*-\s*(\d{1,2})\.(\d{2})/);
                    if (endTimeMatch) {
                        const [, endHour, endMin] = endTimeMatch;
                        // Extract date from datetime attribute and create end date in Amsterdam timezone
                        const dateMatch = datetimeAttr ? datetimeAttr.match(/(\d{4})-(\d{2})-(\d{2})/) : null;
                        if (dateMatch) {
                            const [, year, month, day] = dateMatch;
                            const endHourStr = String(parseInt(endHour)).padStart(2, '0');
                            const endMinStr = String(parseInt(endMin)).padStart(2, '0');
                            const endIsoString = `${year}-${month}-${day}T${endHourStr}:${endMinStr}:00+01:00`;
                            endDate = new Date(endIsoString);
                        } else {
                            // Fallback: use startDate's date components
                            const year = startDate.getUTCFullYear();
                            const month = String(startDate.getUTCMonth() + 1).padStart(2, '0');
                            const day = String(startDate.getUTCDate()).padStart(2, '0');
                            const endHourStr = String(parseInt(endHour)).padStart(2, '0');
                            const endMinStr = String(parseInt(endMin)).padStart(2, '0');
                            const endIsoString = `${year}-${month}-${day}T${endHourStr}:${endMinStr}:00+01:00`;
                            endDate = new Date(endIsoString);
                        }
                    }
                }
                
                // Final fallback: if we still don't have dates, skip this screening
                if (!startDate || !endDate) {
                    console.log(`Screening ${index + 1}: Could not determine start/end times. Text: ${timeText}, datetime: ${datetimeAttr}`);
                    return;
                }
                
                // Validate dates
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    console.error(`Screening ${index + 1}: Invalid date`);
                    return;
                }
                
                // Extract location: find <span> that comes after <time> in the same container
                let location = '';
                $time.nextAll('span').first().each((i, span) => {
                    const locText = $(span).text().trim();
                    // Validate it looks like a location
                    if (locText.length > 0 && locText.length < 50 && 
                        (locText.match(/^(KINO|Cinerama|Pathé|LantarenVenster|de Doelen|Theater|Oude|Nieuwe|Luxor|WORM|V2|Nieuwe Instituut|Stationshal|Brutus|Katoenhuis|Podium|Roodkapje|Muziekwerf|Fenix|Plein)/i) ||
                         locText.match(/\d+$/) || locText.split(' ').length <= 3)) {
                        location = locText;
                    }
                });
                
                // Extract films from nested <ul> with "This screening consists of the following films:"
                const filmsInScreening = [];
                $li.find('h3').each((i, h3) => {
                    if ($(h3).text().includes('This screening consists of the following films:')) {
                        $(h3).next('ul').find('li').each((j, filmLi) => {
                            const filmTitle = $(filmLi).text().trim();
                            if (filmTitle) {
                                filmsInScreening.push(filmTitle);
                            }
                        });
                    }
                });
                
                // Check for Q&A
                const hasQA = $li.text().includes('with Q&A') || $li.text().includes('with Q&amp;A');
                
                // Check availability
                const liText = $li.text();
                const hasBuyTicketButton = /buy\s*ticket/i.test(liText);
                const hasSoldOutText = /sold\s*out/i.test(liText);
                const hasSidewaysWritingMode = $li.find('[style*="writing-mode: sideways-lr"]').length > 0;
                const hasPressIndustryText = /press\s*(&|and|&amp;)\s*industry/i.test(liText);
                const isPressIndustry = hasSidewaysWritingMode && hasPressIndustryText;
                const isSoldOut = hasSoldOutText && (!hasBuyTicketButton || liText.indexOf('sold') < liText.indexOf('buy'));
                const isAvailable = !isPressIndustry && !isSoldOut;
                const unavailableReason = isPressIndustry ? 'Press & Industry' : (isSoldOut ? 'Sold Out' : null);
                
                const startDateStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const startTimeStr = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                const endTimeStr = endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                console.log(`✓ Parsed screening ${index + 1}: ${startDateStr} | ${startTimeStr} - ${endTimeStr} | Location: ${location} | Q&A: ${hasQA}`);
                console.log(`  Films in this screening: ${filmsInScreening.length} - ${filmsInScreening.join(', ')}`);
                console.log(`  Available: ${isAvailable}, Reason: ${unavailableReason}`);
                
                screenings.push({
                    startTime: startDate.toISOString(),
                    endTime: endDate.toISOString(),
                    location: location,
                    link: url,
                    hasQA: hasQA,
                    available: isAvailable,
                    unavailableReason: unavailableReason,
                    films: filmsInScreening.length > 0 ? filmsInScreening : undefined
                });
            } catch (e) {
                console.error(`Error parsing screening ${index + 1}:`, e);
            }
        });
        
        console.log(`Total screenings parsed: ${screenings.length}`);

        // Detect combined programmes and extract all films using cheerio
        let isCombinedProgramme = false;
        let combinedFilms = [];
        
        // Collect films from screenings (most reliable source)
        const screeningFilms = new Set();
        const screeningFilmsWithLinks = new Map();
        
        screenings.forEach((screening, index) => {
            if (screening.films && screening.films.length > 0) {
                console.log(`Screening ${index + 1} has ${screening.films.length} films`);
                screening.films.forEach(filmTitle => {
                    screeningFilms.add(filmTitle);
                });
            }
        });
        
        // Also check "In this combined programme" section using cheerio
        const searchText = isEventPage ? 'In this combined programme' : 'Also in this combined programme';
        $('*').each((i, elem) => {
            const $elem = $(elem);
            if ($elem.text().includes(searchText)) {
                // Find the list (ul or ol) that follows
                $elem.nextAll('ul, ol').first().find('a[href*="/films/"]').each((j, link) => {
                    const $link = $(link);
                    const filmUrl = $link.attr('href').startsWith('http') 
                        ? $link.attr('href') 
                        : `https://iffr.com${$link.attr('href')}`;
                    // Try to find film title in heading within the link or nearby
                    const $heading = $link.find('h2, h3').first();
                    const filmTitle = $heading.length > 0 ? $heading.text().trim() : $link.text().trim();
                    if (filmTitle && (isEventPage || filmTitle !== title)) {
                        screeningFilms.add(filmTitle);
                        screeningFilmsWithLinks.set(filmTitle, filmUrl);
                    }
                });
            }
        });
        
        console.log(`Total unique films found: ${screeningFilms.size}`);
        
        // If we found multiple films, mark as combined and use them
        if (screeningFilms.size > 1) {
            isCombinedProgramme = true;
            console.log(`Marking as combined programme based on ${screeningFilms.size} films`);
            
            combinedFilms = [];
            screeningFilms.forEach(filmTitle => {
                combinedFilms.push({
                    title: filmTitle,
                    link: screeningFilmsWithLinks.get(filmTitle) || null
                });
            });
        }
        
        console.log(`Final combinedFilms count: ${combinedFilms.length}`);
        
        // Final summary
        const finalIsCombined = isCombinedProgramme || isEventPage;
        console.log('\n=== PARSING SUMMARY ===');
        console.log(`Title: ${title}`);
        console.log(`Is Event Page: ${isEventPage}`);
        console.log(`Is Combined Programme: ${finalIsCombined}`);
        console.log(`Combined Films Count: ${combinedFilms.length}`);
        console.log(`Screenings Count: ${screenings.length}`);
        if (screenings.length > 0) {
            screenings.forEach((s, i) => {
                console.log(`  Screening ${i + 1}: ${new Date(s.startTime).toLocaleString()} - ${new Date(s.endTime).toLocaleString()} at ${s.location || 'Unknown'}`);
            });
        }
        console.log('=======================\n');
        
        // If we somehow didn't parse any screenings, try a safe fallback using the first <time datetime> on the page
        let finalScreenings = screenings;
        if (finalScreenings.length === 0) {
            try {
                const $firstTime = $('time[datetime]').first();
                if ($firstTime.length > 0) {
                    const datetimeAttr = $firstTime.attr('datetime'); // e.g. "2026-01-31 19:45"
                    const text = $firstTime.text().trim(); // e.g. "zaterdag 31 januari 2026 | 19.45 - 22.57"
                    
                    let startDate, endDate;
                    
                    // Parse start from datetime attribute
                    // IFFR times are in Amsterdam timezone (CET = UTC+1 for Jan-Feb)
                    if (datetimeAttr) {
                        const m = datetimeAttr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
                        if (m) {
                            const [, year, month, day, hour, minute] = m;
                            const isoString = `${year}-${month}-${day}T${hour}:${minute}:00+01:00`;
                            startDate = new Date(isoString);
                        }
                    }
                    
                    // Parse end time from text "19.45 - 22.57"
                    const endMatch = text.match(/\|\s*\d{1,2}\.\d{2}\s*-\s*(\d{1,2})\.(\d{2})/);
                    if (startDate && endMatch) {
                        const [, endHour, endMin] = endMatch;
                        // Extract date from datetime attribute
                        const dateMatch = datetimeAttr.match(/(\d{4})-(\d{2})-(\d{2})/);
                        if (dateMatch) {
                            const [, year, month, day] = dateMatch;
                            const endHourStr = String(parseInt(endHour)).padStart(2, '0');
                            const endMinStr = String(parseInt(endMin)).padStart(2, '0');
                            const endIsoString = `${year}-${month}-${day}T${endHourStr}:${endMinStr}:00+01:00`;
                            endDate = new Date(endIsoString);
                        }
                    }
                    
                    if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                        finalScreenings = [{
                            startTime: startDate.toISOString(),
                            endTime: endDate.toISOString(),
                            location: '',
                            link: url,
                            note: 'Parsed from first time element; location may be missing'
                        }];
                        console.log('Fallback: created screening from first <time> element instead of using today as default.');
                    }
                }
            } catch (e) {
                console.error('Error while building fallback screening from first <time> element:', e);
            }
            
            // Absolute last resort: keep the simple 120-minute block starting now,
            // but this should rarely be used after the above logic.
            if (finalScreenings.length === 0) {
                finalScreenings = [{
                    startTime: new Date().toISOString(),
                    endTime: new Date(Date.now() + 120 * 60 * 1000).toISOString(), // Default 120 minutes
                    location: '',
                    link: url,
                    note: 'No screenings found - please add manually'
                }];
            }
        }
        
        res.json({
            title: title,
            director: director,
            country: countries,
            programme: programme,
            iffrLink: url, // Include the original URL in the response
            isEventPage: isEventPage, // Indicates this is a programme/event page, not an individual film
            isCombinedProgramme: finalIsCombined, // Event pages are always combined programmes
            combinedFilms: combinedFilms,
            screenings: finalScreenings
        });
    } catch (error) {
        console.error('IFFR parse error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Notion create page endpoint
app.post('/api/notion/create', async (req, res) => {
    try {
        const { databaseId, apiKey, film } = req.body;
        
        if (!databaseId || !apiKey || !film) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Map film to Notion properties
        const properties = {
            'Title': {
                'title': [{ 'text': { 'content': film.title } }]
            }
        };

        if (film.director) {
            properties['Director'] = {
                'rich_text': [{ 'text': { 'content': film.director } }]
            };
        }
        if (film.country) {
            properties['Country'] = {
                'rich_text': [{ 'text': { 'content': film.country } }]
            };
        }
        if (film.programme) {
            properties['Programme'] = {
                'rich_text': [{ 'text': { 'content': film.programme } }]
            };
        }
        if (film.location) {
            properties['Location'] = {
                'rich_text': [{ 'text': { 'content': film.location } }]
            };
        }
        if (film.iffrLink) {
            properties['IFFR Link'] = {
                'url': film.iffrLink
            };
            console.log('Including IFFR Link in Notion properties:', film.iffrLink);
        } else {
            console.log('WARNING: No IFFR Link found in film object. Film:', film.title, 'Keys:', Object.keys(film));
        }

        // Date properties
        if (film.startTime) {
            properties['Start Time'] = {
                'date': {
                    'start': new Date(film.startTime).toISOString()
                }
            };
        }
        if (film.endTime) {
            properties['End Time'] = {
                'date': {
                    'start': new Date(film.endTime).toISOString()
                }
            };
        }

        // Checkbox properties
        properties['Favorited'] = { 'checkbox': film.favorited || false };
        properties['Ticket'] = { 'checkbox': film.ticket || false };
        properties['Moderating'] = { 'checkbox': film.moderating || false };
        properties['Q&A'] = { 'checkbox': film.hasQA || false };
        // Explicitly handle unavailable - ensure boolean value
        const unavailableValue = film.unavailable === true || film.unavailable === 'true';
        properties['Unavailable'] = { 'checkbox': unavailableValue };
        
        // Store screenings as JSON string if available (for switching screenings later)
        if (film.screenings && Array.isArray(film.screenings) && film.screenings.length > 0) {
            const screeningsJson = JSON.stringify(film.screenings);
            console.log('Saving screenings to Notion:', film.screenings.length, 'screenings, JSON length:', screeningsJson.length);
            properties['Screenings'] = {
                'rich_text': [{ 'text': { 'content': screeningsJson } }]
            };
        } else {
            console.log('No screenings to save for film:', film.title);
        }
        
        // Store notes if provided
        if (film.notes) {
            properties['Notes'] = {
                'rich_text': [{ 'text': { 'content': film.notes } }]
            };
        }

        const response = await fetch(`https://api.notion.com/v1/pages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                parent: { database_id: databaseId },
                properties: properties
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Notion create error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Notion delete/archive page endpoint
app.post('/api/notion/delete', async (req, res) => {
    try {
        const { pageId, apiKey } = req.body;
        
        if (!pageId || !apiKey) {
            return res.status(400).json({ error: 'Missing pageId or apiKey' });
        }

        // Archive the page (Notion doesn't support hard delete via API)
        const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                archived: true
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Notion delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Notion update page endpoint
app.post('/api/notion/update', async (req, res) => {
    try {
        const { pageId, apiKey, updates } = req.body;
        
        if (!pageId || !apiKey || !updates) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Build properties object from updates
        // Support both simple status updates and full film updates
        const properties = {};
        
        // Handle full film object updates
        if (updates['Title']) {
            properties['Title'] = { 'title': [{ 'text': { 'content': updates['Title'] } }] };
        }
        // Handle Start Time - null clears the field, otherwise set the date
        if (updates['Start Time'] !== undefined) {
            if (updates['Start Time'] === null) {
                properties['Start Time'] = null; // Clear the date field
            } else {
                properties['Start Time'] = {
                    'date': { 'start': new Date(updates['Start Time']).toISOString() }
                };
            }
        }
        // Handle End Time - null clears the field, otherwise set the date
        if (updates['End Time'] !== undefined) {
            if (updates['End Time'] === null) {
                properties['End Time'] = null; // Clear the date field
            } else {
                properties['End Time'] = {
                    'date': { 'start': new Date(updates['End Time']).toISOString() }
                };
            }
        }
        if (updates['Location']) {
            properties['Location'] = { 'rich_text': [{ 'text': { 'content': updates['Location'] } }] };
        }
        if (updates['Director']) {
            properties['Director'] = { 'rich_text': [{ 'text': { 'content': updates['Director'] } }] };
        }
        if (updates['Country']) {
            properties['Country'] = { 'rich_text': [{ 'text': { 'content': updates['Country'] } }] };
        }
        if (updates['Programme']) {
            properties['Programme'] = { 'rich_text': [{ 'text': { 'content': updates['Programme'] } }] };
        }
        if (updates['IFFR Link']) {
            properties['IFFR Link'] = { 'url': updates['IFFR Link'] };
        }
        if (updates['Screenings']) {
            properties['Screenings'] = {
                'rich_text': [{ 'text': { 'content': typeof updates['Screenings'] === 'string' ? updates['Screenings'] : JSON.stringify(updates['Screenings']) } }]
            };
        }
        if (updates['Notes']) {
            properties['Notes'] = {
                'rich_text': [{ 'text': { 'content': updates['Notes'] } }]
            };
        }
        
        // Handle simple status updates (backward compatibility)
        if (updates.favorited !== undefined) {
            properties['Favorited'] = { 'checkbox': updates.favorited };
        }
        if (updates.ticket !== undefined) {
            properties['Ticket'] = { 'checkbox': updates.ticket };
        }
        if (updates.moderating !== undefined) {
            properties['Moderating'] = { 'checkbox': updates.moderating };
        }
        if (updates.hasQA !== undefined) {
            properties['Q&A'] = { 'checkbox': updates.hasQA };
        }
        if (updates.unavailable !== undefined) {
            // Explicitly handle unavailable - ensure boolean value
            const unavailableValue = updates.unavailable === true || updates.unavailable === 'true';
            properties['Unavailable'] = { 'checkbox': unavailableValue };
        }

        const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                properties: properties
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Notion update error:', error);
        res.status(500).json({ error: error.message });
    }
});

// NOTE: Duplicate parser endpoint removed - using the first one (line 78) with combined programme support
// The second endpoint was overriding the first one and causing conflicts

// Notion create page endpoint
app.post('/api/notion/create', async (req, res) => {
    try {
        const { databaseId, apiKey, film } = req.body;
        
        if (!databaseId || !apiKey || !film) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Map film to Notion properties
        const properties = {
            'Title': {
                'title': [{ 'text': { 'content': film.title } }]
            }
        };

        if (film.director) {
            properties['Director'] = {
                'rich_text': [{ 'text': { 'content': film.director } }]
            };
        }
        if (film.country) {
            properties['Country'] = {
                'rich_text': [{ 'text': { 'content': film.country } }]
            };
        }
        if (film.programme) {
            properties['Programme'] = {
                'rich_text': [{ 'text': { 'content': film.programme } }]
            };
        }
        if (film.location) {
            properties['Location'] = {
                'rich_text': [{ 'text': { 'content': film.location } }]
            };
        }
        if (film.iffrLink) {
            properties['IFFR Link'] = {
                'url': film.iffrLink
            };
            console.log('Including IFFR Link in Notion properties:', film.iffrLink);
        } else {
            console.log('WARNING: No IFFR Link found in film object. Film:', film.title, 'Keys:', Object.keys(film));
        }

        // Date properties
        if (film.startTime) {
            properties['Start Time'] = {
                'date': {
                    'start': new Date(film.startTime).toISOString()
                }
            };
        }
        if (film.endTime) {
            properties['End Time'] = {
                'date': {
                    'start': new Date(film.endTime).toISOString()
                }
            };
        }

        // Checkbox properties
        properties['Favorited'] = { 'checkbox': film.favorited || false };
        properties['Ticket'] = { 'checkbox': film.ticket || false };
        properties['Moderating'] = { 'checkbox': film.moderating || false };
        properties['Q&A'] = { 'checkbox': film.hasQA || false };
        // Explicitly handle unavailable - ensure boolean value
        const unavailableValue = film.unavailable === true || film.unavailable === 'true';
        properties['Unavailable'] = { 'checkbox': unavailableValue };
        
        // Store screenings as JSON string if available (for switching screenings later)
        if (film.screenings && Array.isArray(film.screenings) && film.screenings.length > 0) {
            const screeningsJson = JSON.stringify(film.screenings);
            console.log('Saving screenings to Notion:', film.screenings.length, 'screenings, JSON length:', screeningsJson.length);
            properties['Screenings'] = {
                'rich_text': [{ 'text': { 'content': screeningsJson } }]
            };
        } else {
            console.log('No screenings to save for film:', film.title);
        }
        
        // Store notes if provided
        if (film.notes) {
            properties['Notes'] = {
                'rich_text': [{ 'text': { 'content': film.notes } }]
            };
        }

        const response = await fetch(`https://api.notion.com/v1/pages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                parent: { database_id: databaseId },
                properties: properties
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Notion create error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Notion delete/archive page endpoint
app.post('/api/notion/delete', async (req, res) => {
    try {
        const { pageId, apiKey } = req.body;
        
        if (!pageId || !apiKey) {
            return res.status(400).json({ error: 'Missing pageId or apiKey' });
        }

        // Archive the page (Notion doesn't support hard delete via API)
        const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                archived: true
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Notion delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Notion update page endpoint
app.post('/api/notion/update', async (req, res) => {
    try {
        const { pageId, apiKey, updates } = req.body;
        
        if (!pageId || !apiKey || !updates) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Build properties object from updates
        // Support both simple status updates and full film updates
        const properties = {};
        
        // Handle full film object updates
        if (updates['Title']) {
            properties['Title'] = { 'title': [{ 'text': { 'content': updates['Title'] } }] };
        }
        // Handle Start Time - null clears the field, otherwise set the date
        if (updates['Start Time'] !== undefined) {
            if (updates['Start Time'] === null) {
                properties['Start Time'] = null; // Clear the date field
            } else {
                properties['Start Time'] = {
                    'date': { 'start': new Date(updates['Start Time']).toISOString() }
                };
            }
        }
        // Handle End Time - null clears the field, otherwise set the date
        if (updates['End Time'] !== undefined) {
            if (updates['End Time'] === null) {
                properties['End Time'] = null; // Clear the date field
            } else {
                properties['End Time'] = {
                    'date': { 'start': new Date(updates['End Time']).toISOString() }
                };
            }
        }
        if (updates['Location']) {
            properties['Location'] = { 'rich_text': [{ 'text': { 'content': updates['Location'] } }] };
        }
        if (updates['Director']) {
            properties['Director'] = { 'rich_text': [{ 'text': { 'content': updates['Director'] } }] };
        }
        if (updates['Country']) {
            properties['Country'] = { 'rich_text': [{ 'text': { 'content': updates['Country'] } }] };
        }
        if (updates['Programme']) {
            properties['Programme'] = { 'rich_text': [{ 'text': { 'content': updates['Programme'] } }] };
        }
        if (updates['IFFR Link']) {
            properties['IFFR Link'] = { 'url': updates['IFFR Link'] };
        }
        if (updates['Screenings']) {
            properties['Screenings'] = {
                'rich_text': [{ 'text': { 'content': typeof updates['Screenings'] === 'string' ? updates['Screenings'] : JSON.stringify(updates['Screenings']) } }]
            };
        }
        if (updates['Notes']) {
            properties['Notes'] = {
                'rich_text': [{ 'text': { 'content': updates['Notes'] } }]
            };
        }
        
        // Handle simple status updates (backward compatibility)
        if (updates.favorited !== undefined) {
            properties['Favorited'] = { 'checkbox': updates.favorited };
        }
        if (updates.ticket !== undefined) {
            properties['Ticket'] = { 'checkbox': updates.ticket };
        }
        if (updates.moderating !== undefined) {
            properties['Moderating'] = { 'checkbox': updates.moderating };
        }
        if (updates.hasQA !== undefined) {
            properties['Q&A'] = { 'checkbox': updates.hasQA };
        }
        if (updates.unavailable !== undefined) {
            // Explicitly handle unavailable - ensure boolean value
            const unavailableValue = updates.unavailable === true || updates.unavailable === 'true';
            properties['Unavailable'] = { 'checkbox': unavailableValue };
        }

        const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                properties: properties
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Notion update error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Share schedule endpoints - for dynamic sharing that always shows latest version
// POST /api/share - Create or update a shared schedule
app.post('/api/share', (req, res) => {
    try {
        const { userName, films, shareId } = req.body;
        
        if (!userName || !films || !Array.isArray(films)) {
            return res.status(400).json({ error: 'Missing userName or films' });
        }

        // Generate a share ID if not provided (for new shares)
        const id = shareId || generateShareId();
        
        // Store the schedule
        sharedSchedules[id] = {
            userName,
            films,
            createdAt: sharedSchedules[id]?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        saveShares();
        
        res.json({ shareId: id, url: `${req.protocol}://${req.get('host')}?shareId=${id}` });
    } catch (error) {
        console.error('Error saving share:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/share/:id - Retrieve a shared schedule
app.get('/api/share/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        if (!sharedSchedules[id]) {
            return res.status(404).json({ error: 'Share not found' });
        }
        
        res.json(sharedSchedules[id]);
    } catch (error) {
        console.error('Error retrieving share:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper function to generate a unique share ID
function generateShareId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Notion API proxy ready!`);
    console.log(`Share API ready!`);
    console.log(`\n📱 To access from your phone:`);
    console.log(`1. Make sure your phone is on the same WiFi network`);
    console.log(`2. Find your computer's IP address:`);
    console.log(`   - Mac: System Settings > Network > WiFi > Details > IP Address`);
    console.log(`   - Or run: ifconfig | grep "inet " | grep -v 127.0.0.1`);
    console.log(`3. On your phone, open: http://[YOUR-IP-ADDRESS]:${PORT}`);
    console.log(`   Example: http://192.168.1.100:${PORT}\n`);
});
