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

1. In Notion, create a new page or go to an existing page
2. Type `/database` and select **"Table - Inline"** or **"Table - Full page"**
3. Name your database (e.g., "IFFR Films")

### Step 3: Set Up Database Properties

Your database needs these properties (exact names or variations work):


**Required Properties:**
- **Title** (Title property) - The film title
- **Start Time** (Date property) - When the screening starts (with time)
- **End Time** (Date property) - When the screening ends (with time)

**Optional Properties:**
- **Director** (Text property)
- **Country** (Text property)
- **Programme** (Text property)
- **Location** (Text property)
- **IFFR Link** (URL property) - Link to the film on IFFR website
- **Favorited** (Checkbox property)
- **Ticket** (Checkbox property)
- **Moderating** (Checkbox property)
- **Unavailable** (Checkbox property) - Marks time slots as unavailable (e.g., birthdays, other commitments)
- **Screenings** (Text/Rich Text property) - Stores all available screenings as JSON (for films with multiple screening times)

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
