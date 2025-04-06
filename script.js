// Global variables
let zipCodeMedia = {}; // DEPRECATED? Seems unused, consider removing if graffitiData holds everything.
let graffitiData = [];
let areaToZip = {};
let allZips = new Set();
let currentImages = []; // Array to store filtered images for the current selection
let currentImageIndex = -1; // Index of the currently displayed image
let imageScale = 1; // For zoom functionality
let searchTimeout; // For search debounce
let isDataLoaded = false; // Flag to track if data has been loaded

// --- Touch/Swipe Handling ---
let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let touchEndY = 0;
let isSwiping = false;
let isDragging = false; // For potential future drag implementation
let swipeThreshold = 50; // Min pixels horizontally to count as swipe
let swipeVerticalThreshold = 70; // Max pixels vertically to avoid scroll trigger
let controlsTimeout; // To hide mobile controls automatically


// DOM elements
const elements = {
    areaDropdown: document.getElementById('area'),
    zipDropdown: document.getElementById('zipcode'),
    dateRangeDropdown: document.getElementById('dateRange'),
    closedStatusCheckbox: document.getElementById('closedStatus'),
    openStatusCheckbox: document.getElementById('openStatus'),
    searchInput: document.getElementById('search'),
    searchButton: document.getElementById('searchBtn'),
    viewImageButton: document.getElementById('viewImage'), // Filter button
    graffitiImage: document.getElementById('graffitiImage'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    errorMessage: document.getElementById('errorMessage'),
    errorTextElement: document.querySelector('#errorMessage p'), // Specific element for error text
    instructionContainer: document.querySelector('.instruction-container'),
    imageControls: document.getElementById('imageControls'), // Zoom controls container
    zoomInButton: document.getElementById('zoomIn'),
    zoomOutButton: document.getElementById('zoomOut'),
    resetZoomButton: document.getElementById('resetZoom'),
    shareModal: document.getElementById('shareModal'),
    closeModalButton: document.querySelector('#shareModal .close'), // Specific close button
    shareLinkInput: document.getElementById('shareLink'),
    copyLinkButton: document.getElementById('copyLink'),
    totalRequestsElement: document.getElementById('totalRequests'),
    avgResolutionTimeElement: document.getElementById('avgResolutionTime'),
    statusCountsElement: document.getElementById('statusCounts'),
    tryAgainButton: document.getElementById('tryAgainButton'),
    randomStartButton: document.getElementById('randomStartButton'),
    randomStartButtonDesktop: document.getElementById('randomStartButtonDesktop'), // Desktop version
    contentArea: document.querySelector('.content-area'),
    imageContainer: document.getElementById('imageContainer'), // Added
    mobilePanelToggle: document.getElementById('mobilePanelToggle'), // Added
    mobilePanel: document.getElementById('mobilePanel'), // Added
    mobilePanelContent: document.querySelector('.mobile-panel-content'), // Added
    mobilePanelClose: document.getElementById('mobilePanelClose'), // Added
    mobilePanelOverlay: document.getElementById('mobilePanelOverlay'), // Added
    sidebarContent: document.querySelector('.sidebar-content'), // Added
    nextImageDesktop: document.getElementById('nextImageDesktop'), // Added
    shareImageDesktop: document.getElementById('shareImageDesktop'), // Added
    prevImageMobile: document.getElementById('prevImageMobile'), // Added
    nextImageMobile: document.getElementById('nextImageMobile'), // Added
    shareImageMobile: document.getElementById('shareImageMobile'), // Added
    mobileOverlayControls: document.querySelector('.image-overlay-controls'), // Added
    // Original next/share buttons might be aliased to desktop ones if IDs didn't change
    nextImageButton: document.getElementById('nextImageDesktop'), // Alias if needed
    shareImageButton: document.getElementById('shareImageDesktop'), // Alias if needed
};

// --- Initialization ---
window.addEventListener('DOMContentLoaded', function() {
    // Hide instructions and error initially
    elements.instructionContainer.classList.add('hidden');
    elements.errorMessage.classList.add('hidden');
    
    // Only load reference data initially (zip codes and areas)
    fetch('https://raw.githubusercontent.com/jeisey/phiti/main/ref_ziparea.csv')
        .then(handleResponse)
        .then(processReferenceData)
        .then(() => {
            hideLoadingScreen();
            showInstructions();
            initializeUIState();
            
            // Load initial random image from separate endpoint
            return fetch('random_sample.json');
        })
        .then(response => response.json())
        .then(randomData => {
            // Display random image without loading full dataset
            displayGraffitiImage(randomData);
        })
        .catch(error => {
            console.error('Failed to load initial data:', error);
            showErrorMessage('Failed to load application data. Please try refreshing.');
        });
});

// Add this variable and function
let isStatsLoaded = false;

function loadStatsData() {
    showLoadingScreen();
    fetch('https://raw.githubusercontent.com/jeisey/phiti/main/graffiti.csv')
        .then(handleResponse)
        .then(processGraffitiData)
        .then(() => {
            updateStats();
            isStatsLoaded = true;
            isDataLoaded = true;
            hideLoadingScreen();
        })
        .catch(handleError);
}

// --- Loading and State Management ---

function showLoadingScreen() {
    elements.loadingIndicator.classList.remove('hidden');
    // Optional: Add class to body or content area if needed for styling
    // elements.contentArea.classList.add('loading');
}

function hideLoadingScreen() {
    elements.loadingIndicator.classList.add('hidden');
    // elements.contentArea.classList.remove('loading');
}

function showInstructions() {
    elements.instructionContainer.classList.remove('hidden');
    elements.instructionContainer.style.display = 'flex'; // Ensure flex display
    elements.graffitiImage.classList.add('hidden'); // Hide image if instructions shown
    elements.errorMessage.classList.add('hidden'); // Hide error
}

function hideInstructions() {
     elements.instructionContainer.classList.add('hidden');
     elements.instructionContainer.style.display = 'none';
}


function showErrorMessage(message) {
    if (elements.errorTextElement) {
        elements.errorTextElement.textContent = message;
    } else {
        console.warn("Error message paragraph element not found");
    }
    elements.errorMessage.classList.remove('hidden');
    // Hide other elements that shouldn't show with error
    elements.graffitiImage.classList.add('hidden');
    elements.instructionContainer.classList.add('hidden');
    hideLoadingScreen();
    updateButtonStates(); // Disable buttons etc.
}

function hideErrorMessage() {
    elements.errorMessage.classList.add('hidden');
}

// --- Data Processing ---

function handleResponse(response) {
    if (!response.ok) {
        throw new Error(`Network error: ${response.status} ${response.statusText}`);
    }
    return response.text();
}

function handleError(error) {
    console.error('Error loading data:', error);
    // Error will be caught by Promise.all catch block
    throw error; // Re-throw to be caught by the main catch
}

function processReferenceData(data) {
    // Clear existing options first
    elements.areaDropdown.innerHTML = '';

    const rows = data.trim().split('\n');
    const startIndex = rows[0].includes('Zip,District') ? 1 : 0;

    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = "All Areas";
    elements.areaDropdown.appendChild(defaultOption);

    areaToZip = {}; // Reset
    allZips = new Set(); // Reset

    for (let i = startIndex; i < rows.length; i++) {
        // Basic split, assumes no commas within fields in ref data
        const columns = rows[i].split(',');
        if (columns.length < 2) continue; // Need at least Zip and District

        const zipcode = columns[0]?.trim();
        const area = columns[1]?.trim();

        if (zipcode && /^\d{5}$/.test(zipcode)) { // Validate 5-digit zip
            allZips.add(zipcode);

            if (area && area !== "Not Applicable") { // Exclude "Not Applicable" if desired
                if (!areaToZip[area]) {
                    areaToZip[area] = [];
                    const option = document.createElement('option');
                    option.value = area;
                    option.textContent = area;
                    elements.areaDropdown.appendChild(option);
                }
                // Check if zip already exists for this area to prevent duplicates if ref file isn't clean
                if (!areaToZip[area].includes(zipcode)) {
                     areaToZip[area].push(zipcode);
                }
            }
        }
    }
    // Sort areas alphabetically
    Array.from(elements.areaDropdown.options)
        .slice(1) // Skip "All Areas"
        .sort((a, b) => a.text.localeCompare(b.text))
        .forEach(option => elements.areaDropdown.appendChild(option));


    allZips = new Set([...allZips].sort((a, b) => parseInt(a) - parseInt(b)));
    populateZipDropdown(); // Populate initially with all sorted zips
}


function processGraffitiData(data) {
    const rows = data.trim().split('\n');
    const startIndex = rows[0].includes('cartodb_id') ? 1 : 0;
    graffitiData = []; // Reset

    for (let i = startIndex; i < rows.length; i++) {
        try {
            const columns = parseCSVLine(rows[i]);
            // Expected columns: cartodb_id[0], service_request_id[2], status[3], status_notes[4], requested_datetime[5], closed_datetime[8], address[9], zipcode[10], media_url[11], area[15? -> recalculated later], time_to_close[14?]
            if (columns.length < 12) continue; // Need at least up to media_url

            const media_url = columns[11]?.trim();
            const zipcode = columns[10]?.trim().replace(/\.0$/, ''); // Clean zipcode
            const requested_datetime_raw = columns[5]?.trim();
            const status = columns[3]?.trim();

            // Basic validation
            if (!media_url || !zipcode || !/^\d{5}$/.test(zipcode) || !requested_datetime_raw || !status) {
                // console.warn(`Skipping row ${i + 1}: Missing essential data or invalid zip.`);
                continue;
            }
            // Further filter out clearly invalid media URLs if needed
             if (!media_url.toLowerCase().startsWith('http')) {
                 // console.warn(`Skipping row ${i + 1}: Invalid media_url format.`);
                 continue;
             }


            // Use calculated time_to_close if available and valid, otherwise mark N/A
            let time_to_close_val = "N/A";
            const time_to_close_raw = columns[14]?.trim();
             if (time_to_close_raw && !isNaN(time_to_close_raw) && parseFloat(time_to_close_raw) >= 0) {
                 time_to_close_val = Math.round(parseFloat(time_to_close_raw)).toString(); // Use rounded integer days
             } else if (status === 'Closed' && columns[8]?.trim()) {
                 // Attempt calculation if closed and raw value missing/invalid
                 const reqDate = parseDate(requested_datetime_raw);
                 const closeDate = parseDate(columns[8]?.trim());
                 if (reqDate && closeDate && closeDate >= reqDate) {
                      time_to_close_val = Math.round((closeDate - reqDate) / (1000 * 60 * 60 * 24)).toString();
                 }
             }


            graffitiData.push({
                id: columns[0]?.trim(),
                service_request_id: columns[2]?.trim(),
                zipcode: zipcode,
                media_url: media_url,
                // Area will be added/updated after ref_data is processed
                area: "Unknown", // Placeholder
                time_to_close: time_to_close_val,
                requested_datetime: formatDate(requested_datetime_raw), // Formatted date
                requested_datetime_obj: parseDate(requested_datetime_raw), // Date object for filtering
                closed_datetime: formatDate(columns[8]?.trim()),
                address: columns[9]?.trim() || 'N/A',
                status: status, // Assuming 'Open' or 'Closed'
                status_notes: columns[4]?.trim() || 'No notes provided'
            });
        } catch (error) {
            console.error(`Error processing graffiti data row ${i + 1}:`, error, "Row content:", rows[i]);
        }
    }

     // Now map area from ref_data based on zipcode
     const zipToAreaMap = {};
     for (const area in areaToZip) {
         areaToZip[area].forEach(zip => {
             zipToAreaMap[zip] = area;
         });
     }

     graffitiData.forEach(item => {
         item.area = zipToAreaMap[item.zipcode] || "Area Not Found"; // Assign area or default
     });

     console.log(`Processed ${graffitiData.length} graffiti records.`);

}


function parseCSVLine(line) {
    const result = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && (i === 0 || line[i-1] !== '\\')) { // Handle escaped quotes if necessary (basic)
            // Check for double double-quotes representing a single quote inside quotes
            if (inQuotes && line[i+1] === '"') {
                cell += '"';
                i++; // Skip the next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(cell.trim());
            cell = '';
        } else {
            cell += char;
        }
    }
    result.push(cell.trim()); // Add the last cell
    return result;
}

function parseDate(dateString) {
     if (!dateString || dateString === 'N/A') return null;
     try {
          // Handle potential timezone offsets like "+00" or "Z"
          const cleanedDateString = dateString.replace(/(\+00|Z)$/i, '').trim();
          const date = new Date(cleanedDateString);
          return isNaN(date.getTime()) ? null : date;
     } catch (error) {
         console.warn("Could not parse date:", dateString, error);
         return null;
     }
}

function formatDate(dateString) {
    const date = parseDate(dateString);
    if (!date) return 'N/A';

    try {
        return date.toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Invalid Date'; // Return indicator of formatting error
    }
}

// --- UI Population and Filtering ---

function populateZipDropdown(selectedArea = null) {
    const currentZip = elements.zipDropdown.value; // Preserve selection if possible
    elements.zipDropdown.innerHTML = ''; // Clear existing

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'All Zip Codes';
    elements.zipDropdown.appendChild(defaultOption);

    // Determine which zips to show: filtered by area or all available zips
    let zipsToShow = [];
    if (selectedArea && areaToZip[selectedArea]) {
        zipsToShow = [...areaToZip[selectedArea]]; // Clone array
    } else {
        zipsToShow = Array.from(allZips);
    }

     // Filter zips to only include those present in the actual graffiti data
     const zipsInData = new Set(graffitiData.map(item => item.zipcode));
     zipsToShow = zipsToShow.filter(zip => zipsInData.has(zip));


    // Sort numerically
    zipsToShow.sort((a, b) => parseInt(a) - parseInt(b));

    zipsToShow.forEach(zip => {
        const option = document.createElement('option');
        option.value = zip;
        option.textContent = zip;
        elements.zipDropdown.appendChild(option);
    });

     // Try to restore previous selection if it's still valid
     if (zipsToShow.includes(currentZip)) {
         elements.zipDropdown.value = currentZip;
     }
}


function filterGraffitiData() {
    const selectedZip = elements.zipDropdown.value;
    const selectedArea = elements.areaDropdown.value;
    const selectedDateRange = elements.dateRangeDropdown.value;
    const closedChecked = elements.closedStatusCheckbox.checked;
    const openChecked = elements.openStatusCheckbox.checked;
    const searchTerm = elements.searchInput.value.trim().toLowerCase();


    // Start with all data
    let filtered = [...graffitiData];

    // Filter by Area
    if (selectedArea) {
        filtered = filtered.filter(item => item.area === selectedArea);
    }

    // Filter by Zip Code
    if (selectedZip) {
        filtered = filtered.filter(item => item.zipcode === selectedZip);
    }

    // Filter by Date Range
    if (selectedDateRange !== 'all' && selectedDateRange) {
        const now = new Date();
        let cutoffDate;
        // Adjust date calculation to avoid modifying 'now' repeatedly
        switch (selectedDateRange) {
             case 'lastWeek':
                 cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                 break;
             case 'lastMonth':
                 cutoffDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                 break;
             case 'last3Months':
                 cutoffDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                 break;
             case 'lastYear':
                  cutoffDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                 break;
             default:
                  cutoffDate = null; // Should not happen with 'all' check
        }

        if (cutoffDate) {
             filtered = filtered.filter(item => item.requested_datetime_obj && item.requested_datetime_obj >= cutoffDate);
        }
    }

    // Filter by Status
    if (!closedChecked || !openChecked) { // Only filter if not both checked
         if (closedChecked) {
              filtered = filtered.filter(item => item.status === 'Closed');
         } else if (openChecked) {
              filtered = filtered.filter(item => item.status === 'Open');
         } else {
              filtered = []; // Neither checked, show nothing
         }
    }

     // Filter by Search Term (applied last)
     if (searchTerm) {
         filtered = filtered.filter(item =>
             (item.area && item.area.toLowerCase().includes(searchTerm)) ||
             (item.address && item.address.toLowerCase().includes(searchTerm)) ||
             (item.zipcode && item.zipcode.includes(searchTerm)) || // Zip is already string
             (item.service_request_id && item.service_request_id.toLowerCase().includes(searchTerm)) ||
             (item.id && item.id.toLowerCase().includes(searchTerm)) // Search by cartodb_id too
         );
     }


    return filtered;
}


// --- Image Display and Navigation ---

function loadRandomImage() {
    showLoadingScreen();
    hideErrorMessage();
    hideInstructions();

    // If filters are active, we need the full dataset
    if (needsFullDataset()) {
        if (!isDataLoaded) {
            return loadFullDataset().then(() => {
                const filtered = filterGraffitiData();
                return loadRandomFromFiltered(filtered);
            });
        }
        const filtered = filterGraffitiData();
        return loadRandomFromFiltered(filtered);
    }

    // Otherwise, just get a random image from the sample endpoint
    return fetch('random_sample.json')
        .then(response => response.json())
        .then(displayGraffitiImage)
        .catch(handleImageError)
        .finally(hideLoadingScreen);
}

function needsFullDataset() {
    return elements.areaDropdown.value || 
           elements.zipDropdown.value || 
           elements.dateRangeDropdown.value !== 'all' ||
           elements.searchInput.value.trim() ||
           !(elements.closedStatusCheckbox.checked && elements.openStatusCheckbox.checked);
}

function loadNextImage() {
    if (currentImages.length <= 1) return; // No next if 0 or 1 image
    showLoadingScreen();
    elements.graffitiImage.classList.add('hidden'); // Hide current image immediately
    currentImageIndex = (currentImageIndex + 1) % currentImages.length;
    displayCurrentImage();
}

function loadPreviousImage() {
    if (currentImages.length <= 1) return;
    showLoadingScreen();
    elements.graffitiImage.classList.add('hidden');
    currentImageIndex = (currentImageIndex - 1 + currentImages.length) % currentImages.length;
    displayCurrentImage();
}


function displayCurrentImage() {
    if (currentImages.length === 0 || currentImageIndex < 0 || currentImageIndex >= currentImages.length) {
        hideLoadingScreen();
        // Don't show error here, loadRandomImage handles no results case
        // Maybe show instructions if list becomes empty?
         resetImageView(); // Reset to initial state
         showInstructions();
        return;
    }

    const currentEntry = currentImages[currentImageIndex];
    if (!currentEntry || !currentEntry.media_url) {
         console.error("Invalid current entry or missing media URL:", currentEntry);
         handleImageError("Missing image data for current selection."); // More specific error
         return;
    }


    hideInstructions();
    hideErrorMessage();
    // Keep loader visible until image loads or fails

    resetZoom(); // Reset zoom for new image

    // Set image source and attributes
    elements.graffitiImage.src = currentEntry.media_url;
    elements.graffitiImage.alt = `Graffiti at ${currentEntry.address || 'Unknown Address'} in zip ${currentEntry.zipcode}`; // Better alt text

    // Clear previous handlers to prevent memory leaks
    elements.graffitiImage.onload = null;
    elements.graffitiImage.onerror = null;

    elements.graffitiImage.onload = () => {
        hideLoadingScreen();
        elements.graffitiImage.classList.remove('hidden');
        elements.imageControls.classList.remove('hidden'); // Show zoom controls

        updateInfoDetails(currentEntry);
        updateButtonStates(); // Enable/disable buttons

        // Handle mobile controls visibility
        if (window.innerWidth <= 768) {
            showMobileControls(); // Show controls on new image load
            controlsTimeout = setTimeout(hideMobileControls, 4000); // Auto-hide after delay
        } else {
            hideMobileControls(0); // Ensure hidden on desktop
        }
    };

    elements.graffitiImage.onerror = () => {
        console.error(`Failed to load image: ${currentEntry.media_url}`);
        handleImageError(`Unable to load image. It might be unavailable. URL: ${currentEntry.media_url}`);
    };
}


function handleImageError(customMessage = 'Unable to load the image. It might be unavailable or removed.') {
    hideLoadingScreen();
    elements.graffitiImage.classList.add('hidden'); // Hide image placeholder
    elements.imageControls.classList.add('hidden'); // Hide zoom controls

    // Try to load next image automatically if possible, otherwise show error
     if (currentImages.length > 1) {
         console.warn("Image failed to load, attempting next image...");
         // Remove the failed image from the current list to prevent infinite loop
         const failedUrl = currentImages[currentImageIndex]?.media_url;
         currentImages = currentImages.filter((img, index) => index !== currentImageIndex);

         if (currentImages.length > 0) {
             // Adjust index if needed (it might now be out of bounds)
             currentImageIndex = currentImageIndex % currentImages.length;
              // Update stats for the reduced list
             updateFilteredStats(currentImages);
             // Delay slightly before loading next to avoid rapid failures
             setTimeout(displayCurrentImage, 100);
         } else {
              // Last image failed
              showErrorMessage(customMessage + " No more images in the current selection.");
              resetImageView(); // Reset fully
              updateButtonStates();
         }

     } else {
        // Only one image in the list, and it failed
        showErrorMessage(customMessage);
        resetImageView(); // Reset fully
        updateButtonStates();
     }
     // Always hide mobile controls on error
     hideMobileControls(0);
}


function retryLoadImage() {
    hideErrorMessage(); // Hide error message first
    if (currentImages.length > 0 && currentImageIndex >= 0) {
        showLoadingScreen(); // Show loader while retrying
        displayCurrentImage(); // Attempt to display the same image again
    } else {
        // If no current image selected, try loading a random one based on filters
        loadRandomImage();
    }
}


function updateInfoDetails(entry) {
    document.getElementById('infoArea').textContent = entry.area || 'N/A';
    document.getElementById('infoZipcode').textContent = entry.zipcode || 'N/A';
    document.getElementById('infoTimeToClose').textContent = entry.time_to_close !== 'N/A' ? `${entry.time_to_close} days` : 'N/A';
    document.getElementById('infoDateReported').textContent = entry.requested_datetime || 'N/A';
    document.getElementById('infoAddress').textContent = entry.address || 'N/A';
    document.getElementById('infoStatus').textContent = entry.status || 'N/A';
    document.getElementById('infoStatusNotes').textContent = entry.status_notes || 'N/A';

    // If on mobile and panel is open, potentially scroll info into view (optional)
}

function resetImageView() {
    // Reset UI elements
    elements.graffitiImage.classList.add('hidden');
    elements.graffitiImage.src = ''; // Clear src
    elements.graffitiImage.alt = 'Graffiti Image';
    elements.imageControls.classList.add('hidden');
    hideInstructions(); // Ensure instructions are hidden unless explicitly shown later
    hideErrorMessage();
    hideLoadingScreen(); // Ensure loader is off
    hideMobileControls(0); // Hide mobile controls
    closeMobilePanel(); // Close panel if open

    resetZoom();

    // Clear current selection data (optional, depending if you want 'Next' to persist filter)
    // currentImages = [];
    // currentImageIndex = -1;

    // Clear info fields
    updateInfoDetails({}); // Pass empty object to clear fields

    updateButtonStates(); // Update buttons to disabled state
}

// --- Stats ---

function updateStats() {
    // Update overall stats (only calculated once)
    const totalRequests = graffitiData.length;
    elements.totalRequestsElement.textContent = totalRequests.toLocaleString();

    const closedRequestsWithTime = graffitiData.filter(item =>
        item.status === 'Closed' &&
        item.time_to_close !== 'N/A' &&
        !isNaN(parseInt(item.time_to_close))
    );

    if (closedRequestsWithTime.length > 0) {
        const totalDays = closedRequestsWithTime.reduce((sum, item) => sum + parseInt(item.time_to_close), 0);
        const avgDays = Math.round(totalDays / closedRequestsWithTime.length);
        elements.avgResolutionTimeElement.textContent = avgDays;
    } else {
        elements.avgResolutionTimeElement.textContent = 'N/A';
    }

    // Initial status counts display (based on all data)
    updateFilteredStats(graffitiData);
}

function updateFilteredStats(dataArray) {
     // Updates the status counts displayed based on the currently filtered data
    const closedCount = dataArray.filter(item => item.status === 'Closed').length;
    const openCount = dataArray.filter(item => item.status === 'Open').length;
    const totalFiltered = dataArray.length;

    elements.statusCountsElement.textContent = `Shown: ${totalFiltered} | (${closedCount}) Closed | (${openCount}) Open`;
}


// --- UI Interactions ---

function initializeUIState() {
    // Dropdowns & Filters
    elements.areaDropdown.addEventListener('change', function() {
        populateZipDropdown(this.value || null);
        resetImageView(); // Reset view when area changes
    });
    elements.zipDropdown.addEventListener('change', resetImageView);
    elements.dateRangeDropdown.addEventListener('change', resetImageView);
    elements.closedStatusCheckbox.addEventListener('change', resetImageView);
    elements.openStatusCheckbox.addEventListener('change', resetImageView);

    // Main Action Buttons
    elements.viewImageButton.addEventListener('click', loadRandomImage); // "View Graffiti" button
    elements.randomStartButton.addEventListener('click', loadRandomGraffiti); // Instruction card button
    elements.randomStartButtonDesktop.addEventListener('click', loadRandomGraffiti); // Sidebar button
    elements.tryAgainButton.addEventListener('click', retryLoadImage);

    // Desktop Navigation/Share Buttons (in sidebar)
    elements.nextImageDesktop.addEventListener('click', loadNextImage);
    elements.shareImageDesktop.addEventListener('click', showShareModal);

    // Mobile Navigation/Share Buttons (overlay)
    elements.prevImageMobile.addEventListener('click', loadPreviousImage);
    elements.nextImageMobile.addEventListener('click', loadNextImage);
    elements.shareImageMobile.addEventListener('click', showShareModal);

    // Search
    elements.searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
             // Triggering a filter action resets the view and loads new results
             loadRandomImage(); // Use loadRandomImage to apply filters/search
        }, 500); // Increased debounce time
    });
    elements.searchButton.addEventListener('click', () => {
         clearTimeout(searchTimeout); // Clear timeout if button clicked
         loadRandomImage(); // Use loadRandomImage to apply filters/search
    });
    elements.searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
             clearTimeout(searchTimeout);
             loadRandomImage();
        }
    });

    // Image Controls (Zoom)
    elements.zoomInButton.addEventListener('click', zoomIn);
    elements.zoomOutButton.addEventListener('click', zoomOut);
    elements.resetZoomButton.addEventListener('click', resetZoom);

    // Share Modal
    elements.closeModalButton.addEventListener('click', closeShareModal);
    elements.copyLinkButton.addEventListener('click', copyShareLink);
    elements.shareModal.addEventListener('click', (event) => { // Click outside modal content closes it
        if (event.target === elements.shareModal) {
            closeShareModal();
        }
    });
    document.querySelector('.social-button.twitter').addEventListener('click', shareOnTwitter);
    document.querySelector('.social-button.facebook').addEventListener('click', shareOnFacebook);
    document.querySelector('.social-button.email').addEventListener('click', shareViaEmail);


    // Image Touch/Swipe Listeners
    elements.imageContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
    elements.imageContainer.addEventListener('touchmove', handleTouchMove, { passive: false }); // Need false for vertical check
    elements.imageContainer.addEventListener('touchend', handleTouchEnd);
    // Optional: Handle tap to toggle controls (integrated into touchend)
    // elements.imageContainer.addEventListener('click', handleImageTap); // Could conflict with swipe


    // Mobile Panel Listeners
     elements.mobilePanelToggle.addEventListener('click', openMobilePanel);
     elements.mobilePanelClose.addEventListener('click', closeMobilePanel);
     elements.mobilePanelOverlay.addEventListener('click', closeMobilePanel);

    // Initial state setup
    updateButtonStates(); // Set initial button disabled state
    hideMobileControls(0); // Ensure mobile controls are hidden
}


function updateButtonStates() {
    const hasImages = currentImages.length > 0;
    const hasMultipleImages = currentImages.length > 1;
    const isImageVisible = hasImages && currentImageIndex >= 0 && !elements.graffitiImage.classList.contains('hidden');

    // Desktop Buttons
    elements.nextImageDesktop.disabled = !hasMultipleImages || !isImageVisible;
    elements.shareImageDesktop.disabled = !isImageVisible;

    // Mobile Overlay Buttons
    elements.prevImageMobile.disabled = !hasMultipleImages || !isImageVisible;
    elements.nextImageMobile.disabled = !hasMultipleImages || !isImageVisible;
    elements.shareImageMobile.disabled = !isImageVisible;

     // Zoom Controls should only be enabled if image is visible
     elements.zoomInButton.disabled = !isImageVisible;
     elements.zoomOutButton.disabled = !isImageVisible;
     elements.resetZoomButton.disabled = !isImageVisible;
     // Hide zoom container if no image visible
      if (!isImageVisible) {
          elements.imageControls.classList.add('hidden');
      }

    // Hide mobile overlay if no image is visible
     if (!isImageVisible && window.innerWidth <= 768) {
          hideMobileControls(0);
     }
}


function loadRandomGraffiti() {
    // Reset filters to show all
    elements.areaDropdown.value = '';
    elements.searchInput.value = ''; // Clear search
    populateZipDropdown(); // Show all zips
    elements.zipDropdown.value = '';
    elements.dateRangeDropdown.value = 'all';
    elements.closedStatusCheckbox.checked = true;
    elements.openStatusCheckbox.checked = true;

    resetImageView(); // Reset view before loading
    loadRandomImage(); // Load random based on reset filters
     closeMobilePanel(); // Ensure panel is closed if open
}

// --- Zoom Functionality ---
function zoomIn() {
    applyZoom(imageScale + 0.2);
}

function zoomOut() {
    applyZoom(imageScale - 0.2);
}

function resetZoom() {
    applyZoom(1);
    // Reset position as well if drag/pan is implemented
     elements.graffitiImage.style.transition = 'transform var(--transition-speed)'; // Re-enable transition after potential drag
     elements.graffitiImage.style.objectPosition = 'center center'; // Reset panning
}

function applyZoom(newScale) {
    imageScale = Math.max(0.5, Math.min(newScale, 5)); // Clamp scale between 0.5x and 5x
    elements.graffitiImage.style.transition = 'transform 0.1s linear'; // Faster transition for zoom
    elements.graffitiImage.style.transform = `scale(${imageScale})`;
    // Disable transition again slightly after to allow smooth panning if implemented
     // setTimeout(() => { elements.graffitiImage.style.transition = 'none'; }, 100);
}

// --- Share Functionality ---
function showShareModal() {
    if (currentImages.length === 0 || currentImageIndex < 0) return;

    const currentEntry = currentImages[currentImageIndex];
    if (!currentEntry || !currentEntry.id) {
        console.warn("Cannot share: Missing current entry or ID.");
        // Optionally show a small notification to the user
        return;
    }

    // Generate share URL
    const shareUrl = new URL(window.location.origin + window.location.pathname); // Base URL
    shareUrl.searchParams.set('id', currentEntry.id);
    // Optional: Add other params like zip for context, but ID is primary
    // shareUrl.searchParams.set('zip', currentEntry.zipcode);

    elements.shareLinkInput.value = shareUrl.toString();
    elements.shareModal.classList.remove('hidden');
    elements.copyLinkButton.innerHTML = '<i class="fas fa-copy"></i> Copy'; // Reset button text
    elements.copyLinkButton.disabled = false;
}

function closeShareModal() {
    elements.shareModal.classList.add('hidden');
}

async function copyShareLink() {
    const linkToCopy = elements.shareLinkInput.value;
    const copyButton = elements.copyLinkButton;
    const originalHtml = copyButton.innerHTML;

    // Try modern clipboard API
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(linkToCopy);
            copyButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
            copyButton.disabled = true;
            setTimeout(() => {
                copyButton.innerHTML = originalHtml;
                copyButton.disabled = false;
            }, 2000);
            return; // Success
        } catch (err) {
            console.error('Async clipboard copy failed:', err);
            // Fall through to fallback
        }
    }

    // Fallback using execCommand (less reliable, requires input selection)
    try {
        elements.shareLinkInput.select();
        // For mobile devices, set selection range
        elements.shareLinkInput.setSelectionRange(0, 99999);
        const successful = document.execCommand('copy');
        if (successful) {
            copyButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
            copyButton.disabled = true;
        } else {
             throw new Error('document.execCommand failed');
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
        copyButton.innerHTML = '<i class="fas fa-times"></i> Failed';
        copyButton.disabled = true; // Keep disabled on fail? Maybe not.
    } finally {
         // Deselect input
         window.getSelection()?.removeAllRanges();
         // Reset button after timeout regardless of fallback success/fail
        setTimeout(() => {
            // Only reset if it wasn't changed again
            if (copyButton.innerHTML !== originalHtml) {
                 copyButton.innerHTML = originalHtml;
            }
            copyButton.disabled = false;
        }, 2000);
    }
}


function shareOnTwitter() {
    const url = encodeURIComponent(elements.shareLinkInput.value);
    const text = encodeURIComponent('Check out this graffiti removal request in Philadelphia on Phiti!');
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener,noreferrer');
}

function shareOnFacebook() {
    const url = encodeURIComponent(elements.shareLinkInput.value);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'noopener,noreferrer');
}

function shareViaEmail() {
    const url = elements.shareLinkInput.value; // No need to encode URL for mailto body usually
    const subject = encodeURIComponent('Philadelphia Graffiti on Phiti');
    const body = encodeURIComponent(`Check out this graffiti I found on Phiti:\n\n${url}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
}

// --- Shared Image Loading ---
function checkForSharedImage() {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedId = urlParams.get('id');

    if (sharedId && isDataLoaded) {
        const sharedImage = graffitiData.find(item => item.id === sharedId);

        if (sharedImage) {
            console.log("Found shared image:", sharedImage);
            // Don't set filters based on shared image, just show it directly.
            // The share link implies showing *that specific* image regardless of current filters.

            // Set this image as the only one in currentImages temporarily
            currentImages = [sharedImage];
            currentImageIndex = 0;

            // Update stats based on this single image? Or keep overall/default stats?
             updateFilteredStats(currentImages); // Show stats for this one image

            displayCurrentImage();

             // Clean the URL query parameters after loading
             history.replaceState(null, '', window.location.pathname);

            return true; // Indicate an image was loaded via share link
        } else {
            console.warn(`Shared image ID ${sharedId} not found in processed data.`);
            showErrorMessage(`Could not find the shared image (ID: ${sharedId}). Showing random instead.`);
             // Clean the URL
             history.replaceState(null, '', window.location.pathname);
             // Load random as fallback
             loadRandomGraffiti();
            return false; // Indicate shared image wasn't loaded successfully
        }
    }
    return false; // No shared ID parameter found
}


// --- Mobile Panel ---
function openMobilePanel() {
    // Move sidebar content into the panel for mobile display
    // Check if it's not already there to prevent issues
    if (window.innerWidth <= 768 && elements.sidebarContent && !elements.mobilePanelContent.contains(elements.sidebarContent)) {
         elements.mobilePanelContent.appendChild(elements.sidebarContent);
    }
    elements.mobilePanel.classList.add('open');
    elements.mobilePanelOverlay.classList.add('open');
    elements.mobilePanelToggle.style.display = 'none'; // Hide FAB
}

function closeMobilePanel() {
    // Note: Content remains in panel on mobile. If resize handling to move it back
    // to sidebar on desktop is needed, that logic would go here or in a resize handler.
    elements.mobilePanel.classList.remove('open');
    elements.mobilePanelOverlay.classList.remove('open');
    // Only show FAB if on mobile
    if (window.innerWidth <= 768) {
       elements.mobilePanelToggle.style.display = 'flex'; // Show FAB
    } else {
         elements.mobilePanelToggle.style.display = 'none';
    }
}

// --- Mobile Touch Controls ---

function handleTouchStart(event) {
    if (event.touches.length > 1) { isSwiping = false; return; } // Ignore multi-touch
    touchStartX = event.changedTouches[0].clientX; // Use clientX for screen coords
    touchStartY = event.changedTouches[0].clientY;
    touchEndX = touchStartX; // Reset end points
    touchEndY = touchStartY;
    isSwiping = true; // Assume swipe might start
     // If controls are visible, start timer to hide them on touch start
     // if (elements.mobileOverlayControls.classList.contains('visible')) {
     //     clearTimeout(controlsTimeout);
     //     controlsTimeout = setTimeout(hideMobileControls, 2000);
     // }
}

function handleTouchMove(event) {
    if (!isSwiping || event.touches.length > 1) return;

    touchEndX = event.changedTouches[0].clientX;
    touchEndY = event.changedTouches[0].clientY;

    // Check vertical distance early to cancel swipe if scrolling vertically
    const verticalDist = Math.abs(touchEndY - touchStartY);
    if (verticalDist > swipeVerticalThreshold) {
        // console.log("Vertical scroll detected, cancelling swipe.");
        isSwiping = false;
    }
     // Optional: Prevent default page scroll only if horizontal movement is dominant
     // const horizontalDist = Math.abs(touchEndX - touchStartX);
     // if (horizontalDist > verticalDist) {
     //     // event.preventDefault(); // Be cautious with this, can break scrolling
     // }
}

function handleTouchEnd(event) {
    // Don't process if multi-touch ended or swipe was cancelled
    if (!isSwiping || event.touches.length > 0) {
        isSwiping = false;
        return;
    }

    const horizontalDist = touchEndX - touchStartX;
    const verticalDist = Math.abs(touchEndY - touchStartY); // Check vertical dist again at end

    // Ensure significant horizontal movement and minimal vertical movement
    if (Math.abs(horizontalDist) >= swipeThreshold && verticalDist < swipeVerticalThreshold) {
        // It's a horizontal swipe
        if (horizontalDist < 0) { // Swiped left (Next)
            if (!elements.nextImageMobile.disabled) {
                loadNextImage();
                hideMobileControls(0); // Hide controls immediately
            }
        } else { // Swiped right (Previous)
            if (!elements.prevImageMobile.disabled) {
                loadPreviousImage();
                hideMobileControls(0); // Hide controls immediately
            }
        }
    } else if (Math.abs(horizontalDist) < 10 && verticalDist < 10) {
         // If very little movement, treat as a tap
         // console.log("Tap detected");
         handleImageTap();
    }
    // else: diagonal swipe or small movement - do nothing

    isSwiping = false; // Reset swipe flag
}

function handleImageTap() {
     // Only toggle if an image is actually visible
    if (!elements.graffitiImage.classList.contains('hidden') && window.innerWidth <= 768) {
        toggleMobileControls();
    }
}

function toggleMobileControls() {
    clearTimeout(controlsTimeout); // Clear any existing hide timer
    const controls = elements.mobileOverlayControls;
    if (controls.classList.contains('visible')) {
        hideMobileControls();
    } else {
        showMobileControls();
        // Set a new timer to hide them automatically
        controlsTimeout = setTimeout(hideMobileControls, 4000); // Hide after 4 seconds
    }
}

function showMobileControls() {
     // Only show if an image is visible and on mobile
     if (!elements.graffitiImage.classList.contains('hidden') && window.innerWidth <= 768) {
        updateButtonStates(); // Ensure buttons are correctly enabled/disabled
        elements.mobileOverlayControls.classList.add('visible');
     }
}

function hideMobileControls(delay = 250) { // Default delay matching transition
    clearTimeout(controlsTimeout);
    if (delay > 0) {
         elements.mobileOverlayControls.style.transition = `opacity ${delay/1000}s ease-in-out, visibility ${delay/1000}s ease-in-out`;
    } else {
         elements.mobileOverlayControls.style.transition = 'none';
    }
    elements.mobileOverlayControls.classList.remove('visible');
}

// --- Optional: Resize Handler (Example) ---
// Could be used to move sidebar content back on desktop resize
/*
let currentLayout = window.innerWidth <= 768 ? 'mobile' : 'desktop';
window.addEventListener('resize', () => {
    const newLayout = window.innerWidth <= 768 ? 'mobile' : 'desktop';
    if (newLayout !== currentLayout) {
        if (newLayout === 'desktop' && elements.mobilePanelContent.contains(elements.sidebarContent)) {
            // Move content back to sidebar
            const sidebar = document.querySelector('.sidebar'); // Might need a more robust way to get sidebar
            if (sidebar) {
                 sidebar.appendChild(elements.sidebarContent);
            }
            closeMobilePanel(); // Ensure panel is closed
        } else if (newLayout === 'mobile' && !elements.mobilePanelContent.contains(elements.sidebarContent)) {
             // If panel is open, content should move automatically via openMobilePanel
             // If panel is closed, content might need moving if app starts desktop -> shrinks -> panel opened
             // This logic can get complex, ensure it covers edge cases if implemented.
        }
         elements.mobilePanelToggle.style.display = newLayout === 'mobile' ? 'flex' : 'none';
        currentLayout = newLayout;
    }
});
*/

console.log("Phiti script loaded.");

// Separate function to load stats only when needed
async function loadStatistics() {
    try {
        const response = await fetch('stats_summary.json');
        const stats = await response.json();
        
        elements.totalRequestsElement.textContent = stats.totalRequests.toLocaleString();
        elements.avgResolutionTimeElement.textContent = stats.avgResolutionDays;
        elements.statusCountsElement.textContent = 
            `Open: ${stats.openCount}, Closed: ${stats.closedCount}`;
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// Modify your initialization function to NOT load all data at once
document.addEventListener('DOMContentLoaded', function() {
    // Initialize UI, event listeners, etc.
    
    // Load initial random image without loading all data
    loadRandomImage();
    
    // Delay loading stats until after initial image is shown
    setTimeout(loadStatistics, 2000);
    
    // ...existing code...
});

// Function to load a random image for initial page display
async function loadInitialRandomImage() {
    showLoadingIndicator();
    
    try {
        // Read just the first 20 lines of the CSV instead of the whole file
        const response = await fetch('graffiti.csv?limit=20'); // Add a limit parameter your server can recognize
        const csvText = await response.text();
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        
        // Skip header row and pick a random entry from the first 20
        const randomIndex = Math.floor(Math.random() * (Math.min(lines.length, 20) - 1)) + 1;
        const randomLine = lines[randomIndex];
        const columns = randomLine.split(',');
        
        // Create an entry object from the CSV line
        const randomEntry = {
            media_url: columns[11], // Assuming the URL is in column 11
            address: columns[9],
            status: columns[3],
            requested_datetime: columns[5],
            // Add other needed fields
        };
        
        displayGraffitiImage(randomEntry);
        updateInfoPanel(randomEntry);
        
        // Enable controls after image is loaded
        enableUIControls();
        hideLoadingIndicator();
        hideInstructionContainer();
    } catch (error) {
        console.error('Error loading random image:', error);
        showErrorMessage('Could not load a random image. Please try again.');
    }
}

// Call this function when the page loads
document.addEventListener('DOMContentLoaded', function() {
    loadInitialRandomImage();
    
    // Delay loading stats until after initial image is shown
    setTimeout(loadStatistics, 2000);
    
    // ...existing initialization code...
});

// Add a new function to load a single random image without full dataset
function loadInitialRandomImage() {
    showLoadingScreen();
    
    // Fetch a single random entry from a dedicated endpoint
    fetch('https://raw.githubusercontent.com/jeisey/phiti/main/random_sample.json')
        .then(response => response.json())
        .then(randomEntry => {
            // Display this single entry
            hideInstructions();
            elements.graffitiImage.src = randomEntry.media_url;
            elements.graffitiImage.alt = `Graffiti at ${randomEntry.address || 'Unknown Address'}`;
            elements.graffitiImage.onload = () => {
                hideLoadingScreen();
                elements.graffitiImage.classList.remove('hidden');
                elements.imageControls.classList.remove('hidden');
                updateInfoDetails(randomEntry);
            };
            elements.graffitiImage.onerror = () => {
                showErrorMessage("Unable to load initial image. Please try the 'Random Graffiti' button.");
            };
        })
        .catch(error => {
            console.error("Error loading initial random image:", error);
            hideLoadingScreen();
            showInstructions(); // Show instructions as fallback
        });
}

// Modify the random buttons to work properly
document.getElementById('randomStartButton').addEventListener('click', function() {
    if (isDataLoaded) {
        loadRandomGraffiti();
    } else {
        loadStatsData().then(loadRandomGraffiti);
    }
});
