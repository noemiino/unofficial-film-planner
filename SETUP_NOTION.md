# Setup Instructions for Notion

## Quick Start

1. **Open the tool**: Simply open `index.html` in your web browser
   - On Mac: Right-click → Open With → Your Browser
   - Or drag the file into your browser window

2. **Add your first film**:
   - Click "Manual Entry" button
   - Fill in the film details
   - Click "Add Film"

3. **Navigate the calendar**:
   - Use ← → arrows to move between 5-day periods
   - Click on any film block to view details and manage status

## Features

✅ **5-day calendar view** - See 5 days at a time  
✅ **Manual film entry** - Add films with all details  
✅ **Color coding** - Visual status indicators  
✅ **Overlapping films** - Films at the same time appear side-by-side  
✅ **Local storage** - Your data is saved in your browser  


## Notion Integration

Connect your Notion database to sync films across devices.

### Step 1: Create a Notion Integration

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **"+ New integration"**
3. Give it a name (e.g., "IFFR Film Planner")
4. Select your workspace
5. **Important**: Choose **"Internal"** integration (not Public) - this is for personal use and is simpler
6. Under **"Capabilities"**, make sure these are enabled:
   - ✅ Read content
   - ✅ Update content
   - ✅ Insert content
7. Click **"Submit"**
8. **Copy the "Internal Integration Token"** (starts with `secret_`) - you'll need this in Step 6

**Note**: Internal integrations are perfect for personal tools like this. You don't need a public integration unless you're planning to share this tool with others.

### Step 2: Create a Notion Database

**Option A: Duplicate a Notion Template (Recommended - Preserves Property Types) ⭐**

1. Open this Notion template: **[IFFR Film Planner Template](https://noe-mi.notion.site/2ed513302a5580fb8d4de0a4a594eeaa?v=6611426185744feb8cdd70c5c4d9719f)**
2. Click **"Duplicate"** in the top right corner
3. The database will be created in your workspace with all properties correctly configured!
4. Skip to Step 4 (Share Database with Integration)

**Why this is best:** Duplicating a Notion database preserves all property types (Date, URL, Checkbox, etc.), so everything works perfectly without manual setup.

**Option B: Create manually (Most Reliable) ⭐**

This ensures all property types are correct from the start.

1. In Notion, create a new page or go to an existing page
2. Type `/database` and select **"Table - Inline"** or **"Table - Full page"**
3. Name your database (e.g., "IFFR Films")
4. Add properties one by one with correct types:
   - **Title** - Already exists (Title type)
   - Click **"+"** to add **"Start Time"** → Select **"Date"** → Enable **"Include time"**
   - Click **"+"** to add **"End Time"** → Select **"Date"** → Enable **"Include time"**
   - Click **"+"** to add **"IFFR Link"** → Select **"URL"**
   - Click **"+"** to add **"Director"** → Select **"Text"** or **"Rich text"**
   - Click **"+"** to add **"Country"** → Select **"Text"** or **"Rich text"**
   - Click **"+"** to add **"Programme"** → Select **"Text"** or **"Rich text"**
   - Click **"+"** to add **"Location"** → Select **"Text"** or **"Rich text"**
   - Click **"+"** to add **"Favorited"** → Select **"Checkbox"**
   - Click **"+"** to add **"Ticket"** → Select **"Checkbox"**
   - Click **"+"** to add **"Moderating"** → Select **"Checkbox"**
   - Click **"+"** to add **"Q&A"** → Select **"Checkbox"**
   - Click **"+"** to add **"Unavailable"** → Select **"Checkbox"**
   - Click **"+"** to add **"Screenings"** → Select **"Text"** or **"Rich text"**
   - Click **"+"** to add **"Notes"** → Select **"Text"** or **"Rich text"**

**Tip**: After creating, you can duplicate this database to share as a template with others!

### Step 3: Set Up Database Properties (Only if creating manually)

If you used Option A (duplicate template), skip this step - all properties are already configured!

If you're creating manually (Option B), your database needs these properties (exact names or variations work):


**Required Properties:**
- **Title** (Title property) - The film title
- **Start Time** (Date property with time enabled) - When the screening starts
- **End Time** (Date property with time enabled) - When the screening ends

**Optional Properties:**
- **Director** (Text or Rich text property)
- **Country** (Text or Rich text property)
- **Programme** (Text or Rich text property)
- **Location** (Text or Rich text property)
- **IFFR Link** (URL property) - Link to the film on IFFR website
- **Favorited** (Checkbox property)
- **Ticket** (Checkbox property)
- **Moderating** (Checkbox property)
- **Q&A** (Checkbox property)
- **Unavailable** (Checkbox property) - Marks time slots as unavailable (other commitments)
- **Screenings** (Text or Rich text property) - Stores all available screenings as JSON (for films with multiple screening times)
- **Notes** (Text or Rich text property) - Personal notes about why you want to see the film

**Important Notes:**
- The app automatically detects property types and works with both Date/URL types AND Text types
- If you use Text types for Start Time, End Time, or IFFR Link, the app will convert dates to readable strings
- However, using the correct types (Date for times, URL for links) provides better Notion functionality

**Property Name Variations:**
The app will recognize these variations:
- Title: `Title`, `title`, `Name`, `name`
- Start Time: `Start Time`, `StartTime`, `startTime`
- End Time: `End Time`, `EndTime`, `endTime`
- IFFR Link: `IFFR Link`, `IFFRLink`, `iffrLink`, `Link`, `link`

### Step 4: Share Database with Integration

1. Open your database in Notion
2. Click the **"..."** menu (top right)
3. Click **"Connections"** or **"Add connections"**
4. Find and select your integration (the one you created in Step 1)
5. Click **"Confirm"**

### Step 5: Get Your Database ID

1. Open your database in Notion
2. Look at the URL in your browser
3. The URL will look like: `https://www.notion.so/workspace/[DATABASE-ID]?v=...`
   - Or: `https://www.notion.so/your-workspace/[DATABASE-ID]?v=...`
4. Copy the **Database ID** (the long string of letters, numbers, and dashes)
   - Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
   - You can copy it with or without dashes - both work
   - It's the part between the last `/` and the `?` in the URL

### Step 6: Connect in the App

1. Open the Film Festival Planner
2. Click the **"⚙️ Settings"** button
3. Paste your **Notion API Key** (from Step 1)
4. Paste your **Database ID** (from Step 5)
5. Click **"Test Connection"** to verify it works
6. Click **"Save & Sync"** to load films from Notion

### Troubleshooting

**"CORS Error" or "Failed to fetch" error:**
- ⚠️ **Important**: Notion's API blocks direct browser requests due to CORS (Cross-Origin Resource Sharing) security policies
- This means the Notion integration **requires a backend server** to work properly
- The app will automatically fall back to localStorage if Notion isn't configured or the server isn't available
- **Solutions**:
  - Deploy the included backend server (see [DEPLOYMENT.md](./DEPLOYMENT.md)) - recommended for Notion sync
  - Or continue using localStorage (which works fine for single-device use without Notion)

**"Connection failed" error (other than CORS):**
- Make sure you copied the full API key (starts with `secret_`)
- Verify the database ID is correct
- Check that you shared the database with your integration (Step 4)

**"No films loaded":**
- Make sure your database has at least one page/row
- Verify the "Title" property exists and has values
- Check that "Start Time" and "End Time" are Date properties (not just text)

**Films not showing correctly:**
- Verify property names match (or use the variations listed above)
- Make sure date properties include time (not just dates)
- Check browser console for error messages

### Notes

- The app will **fall back to localStorage** if Notion isn't configured or fails
- Films are **read from Notion** when you save settings
- Films are **automatically synced to Notion** when you create, update, or modify them in the app
- Your data is saved both locally (localStorage) and in Notion (if configured)
