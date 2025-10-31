/**
 * Function to extract Schedule 1 bird species data from HTML table and convert to JSON
 * Table ID: 'toc-table-of-schedule-1-bird-species'
 * Source: https://www.bto.org/get-involved/volunteer/projects/bird-ringing-scheme/taking-part/protected-birds/s1-list
 */

const BTO_SCHEDULE_ONE_URL = 'https://www.bto.org/get-involved/volunteer/projects/bird-ringing-scheme/taking-part/protected-birds/s1-list';

/**
 * Fetch and extract data from BTO webpage (client-side with CORS proxy)
 */
async function fetchScheduleOneDataFromBTO() {
    try {
        // Note: This may require a CORS proxy for client-side requests
        const proxyUrl = 'https://api.allorigins.win/get?url=';
        const targetUrl = encodeURIComponent(BTO_SCHEDULE_ONE_URL);
        
        console.log('Fetching data from BTO website...');
        const response = await fetch(proxyUrl + targetUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const htmlContent = data.contents;
        
        // Parse HTML content
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        
        return extractScheduleOneDataFromDocument(doc);
        
    } catch (error) {
        console.error('Error fetching from BTO website:', error);
        console.log('Fallback: Try using the extractScheduleOneData() function directly on the BTO page');
        return null;
    }
}

/**
 * Extract data from a document (either current page or fetched HTML)
 */
function extractScheduleOneDataFromDocument(doc = document) {
    // Try multiple ways to find the table
    let table = doc.getElementById('toc-table-of-schedule-1-bird-species');
    
    // If not found by ID, try other selectors
    if (!table) {
        console.log('Table not found by ID, trying alternative selectors...');
        
        // Try finding table with Schedule 1 content
        const tables = doc.querySelectorAll('table');
        for (let t of tables) {
            const tableText = t.textContent.toLowerCase();
            if (tableText.includes('schedule') && tableText.includes('species')) {
                table = t;
                console.log('Found table by content matching');
                break;
            }
        }
    }
    
    // If still not found, try finding by headers
    if (!table) {
        const tables = doc.querySelectorAll('table');
        for (let t of tables) {
            const headers = t.querySelectorAll('th, td');
            const headerText = Array.from(headers).map(h => h.textContent.trim().toLowerCase());
            if (headerText.some(h => h.includes('england') || h.includes('scotland') || h.includes('species'))) {
                table = t;
                console.log('Found table by header matching');
                break;
            }
        }
    }
    
    if (!table) {
        console.error('No suitable table found. Available tables:');
        const allTables = doc.querySelectorAll('table');
        allTables.forEach((t, i) => {
            console.log(`Table ${i + 1}:`, t.textContent.substring(0, 100) + '...');
        });
        return null;
    }
    
    console.log('Using table:', table);

    const scheduleOneData = {
        metadata: {
            title: "Schedule 1 Bird Species Protection",
            description: "Birds protected under Schedule 1 of the Wildlife and Countryside Act 1981",
            source: "BTO - British Trust for Ornithology",
            sourceUrl: BTO_SCHEDULE_ONE_URL,
            extractedDate: new Date().toISOString(),
            regions: ["England", "Scotland", "Wales", "Northern Ireland", "Republic of Ireland", "Isle of Man"]
        },
        species: []
    };

    // Get table rows (skip header row)
    const rows = table.querySelectorAll('tr');
    
    if (rows.length === 0) {
        console.error('No rows found in table');
        return null;
    }
    
    const headerRow = rows[0];
    
    // Extract column headers to understand the structure
    const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => 
        cell.textContent.trim()
    );
    
    console.log('Table headers:', headers);
    
    // Process each data row
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.querySelectorAll('td');
        
        if (cells.length === 0) continue; // Skip empty rows
        
        const speciesName = cells[0].textContent.trim();
        
        // Skip rows that are just section dividers (single letters)
        if (speciesName.length === 1 || speciesName === '') continue;
        
        const speciesData = {
            name: speciesName,
            protected_in: {}
        };
        
        // Map each region column (assuming standard 6 regions)
        const regions = ["England", "Scotland", "Wales", "Northern Ireland", "Republic of Ireland", "Isle of Man"];
        
        for (let j = 1; j < Math.min(cells.length, 7); j++) {
            const cellContent = cells[j].textContent.trim();
            const regionName = regions[j - 1];
            
            if (regionName) {
                // Check if protected (Y = yes, empty or space = no)
                if (cellContent === 'Y') {
                    speciesData.protected_in[regionName] = true;
                } else if (cellContent !== '' && cellContent !== ' ') {
                    // Handle special cases like regional restrictions
                    speciesData.protected_in[regionName] = cellContent;
                } else {
                    speciesData.protected_in[regionName] = false;
                }
            }
        }
        
        scheduleOneData.species.push(speciesData);
    }
    
    return scheduleOneData;
}

/**
 * Debug function to check what's available on the page
 */
function debugPageContent() {
    console.log('=== PAGE DEBUG INFO ===');
    console.log('Current URL:', window.location.href);
    
    // Check for the specific table ID
    const targetTable = document.getElementById('toc-table-of-schedule-1-bird-species');
    console.log('Target table found:', !!targetTable);
    
    // List all tables
    const allTables = document.querySelectorAll('table');
    console.log(`Found ${allTables.length} tables on page:`);
    
    allTables.forEach((table, i) => {
        const id = table.id || '(no id)';
        const classes = table.className || '(no classes)';
        const preview = table.textContent.substring(0, 100).replace(/\s+/g, ' ').trim();
        console.log(`Table ${i + 1}: ID="${id}", Classes="${classes}"`);
        console.log(`  Preview: ${preview}...`);
    });
    
    // Look for elements containing "schedule" or "species"
    const scheduleElements = document.querySelectorAll('*');
    let scheduleMatches = 0;
    for (let el of scheduleElements) {
        if (el.textContent.toLowerCase().includes('schedule') && el.textContent.toLowerCase().includes('species')) {
            scheduleMatches++;
            if (scheduleMatches <= 3) { // Show first 3 matches
                console.log(`Schedule content found in: ${el.tagName}`, el);
            }
        }
    }
    console.log(`Found ${scheduleMatches} elements containing "schedule" and "species"`);
    
    return {
        url: window.location.href,
        targetTableFound: !!targetTable,
        totalTables: allTables.length,
        scheduleMatches: scheduleMatches
    };
}

/**
 * Legacy function for backward compatibility - extracts from current page
 */
function extractScheduleOneData() {
    return extractScheduleOneDataFromDocument(document);
}

/**
 * Function to save the extracted data as JSON (updated to use new fetch function)
 */
async function saveScheduleOneDataAsJSON() {
    let data;
    
    // Try to fetch from BTO website first
    data = await fetchScheduleOneDataFromBTO();
    
    // If fetch fails, try extracting from current page
    if (!data) {
        console.log('Falling back to current page extraction...');
        data = extractScheduleOneData();
    }
    
    if (!data) {
        console.error('Failed to extract data from both BTO website and current page');
        return;
    }
    
    // Convert to JSON string with formatting
    const jsonString = JSON.stringify(data, null, 2);
    
    // Create a downloadable file
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'bto_Schedule_One.json';
    downloadLink.textContent = 'Download Schedule One Data JSON';
    
    // Add to page or trigger download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
    }, 100);
    
    // Also log to console for debugging
    console.log('Schedule One Data:', data);
    console.log('Total species found:', data.species.length);
    
    return data;
}

/**
 * Alternative function to copy JSON to clipboard (updated to use new fetch function)
 */
async function copyScheduleOneDataToClipboard() {
    let data;
    
    // Try to fetch from BTO website first
    data = await fetchScheduleOneDataFromBTO();
    
    // If fetch fails, try extracting from current page
    if (!data) {
        console.log('Falling back to current page extraction...');
        data = extractScheduleOneData();
    }
    
    if (!data) {
        console.error('Failed to extract data from both BTO website and current page');
        return;
    }
    
    const jsonString = JSON.stringify(data, null, 2);
    
    navigator.clipboard.writeText(jsonString).then(() => {
        console.log('Schedule One data copied to clipboard');
        alert('Schedule One data copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy to clipboard:', err);
        // Fallback: log to console
        console.log('JSON Data (copy manually):', jsonString);
    });
    
    return data;
}

/**
 * Function to validate the extracted data
 */
function validateScheduleOneData(data) {
    if (!data || !data.species || !Array.isArray(data.species)) {
        return { valid: false, error: 'Invalid data structure' };
    }
    
    const issues = [];
    const regions = ["England", "Scotland", "Wales", "Northern Ireland", "Republic of Ireland", "Isle of Man"];
    
    data.species.forEach((species, index) => {
        if (!species.name || species.name.trim() === '') {
            issues.push(`Species at index ${index} has no name`);
        }
        
        if (!species.protected_in || typeof species.protected_in !== 'object') {
            issues.push(`Species "${species.name}" has invalid protection data`);
        } else {
            // Check for missing regions
            regions.forEach(region => {
                if (!(region in species.protected_in)) {
                    issues.push(`Species "${species.name}" missing data for ${region}`);
                }
            });
        }
    });
    
    return {
        valid: issues.length === 0,
        issues: issues,
        speciesCount: data.species.length
    };
}

// Export functions for browser console usage
window.fetchScheduleOneDataFromBTO = fetchScheduleOneDataFromBTO;
window.extractScheduleOneDataFromDocument = extractScheduleOneDataFromDocument;
window.extractScheduleOneData = extractScheduleOneData;
window.saveScheduleOneDataAsJSON = saveScheduleOneDataAsJSON;
window.copyScheduleOneDataToClipboard = copyScheduleOneDataToClipboard;
window.validateScheduleOneData = validateScheduleOneData;
window.debugPageContent = debugPageContent;

// Usage instructions
console.log(`
BTO Schedule One Data Extractor - Usage Instructions:

EASY USAGE:
1. Visit: ${BTO_SCHEDULE_ONE_URL}
2. Open browser console (F12)
3. Paste this entire script
4. Run: extractScheduleOneData() to get the data
5. Run: saveScheduleOneDataAsJSON() to download as JSON file

ALTERNATIVE (with CORS proxy):
1. From any webpage, run: await fetchScheduleOneDataFromBTO()
2. Or run: await saveScheduleOneDataAsJSON() to fetch and download

FUNCTIONS AVAILABLE:
- debugPageContent() - Check what tables/content are available on current page
- extractScheduleOneData() - Extract from current page
- saveScheduleOneDataAsJSON() - Extract and download JSON
- copyScheduleOneDataToClipboard() - Extract and copy to clipboard
- fetchScheduleOneDataFromBTO() - Fetch from BTO website (may need CORS proxy)
- validateScheduleOneData(data) - Validate extracted data

TROUBLESHOOTING:
If you get an error, first run: debugPageContent()
This will show you what tables are available and help identify the correct one.

Source: ${BTO_SCHEDULE_ONE_URL}
`);
