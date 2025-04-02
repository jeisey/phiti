    // Global variables
let zipCodeMedia = {};
let graffitiData = []; 
let areaToZip = {}; 
let allZips = new Set(); 
let currentImages = []; // Array to store filtered images for the current selection
let currentImageIndex = -1; // Index of the currently displayed image
let imageScale = 1; // For zoom functionality
let searchTimeout; // For search debounce
let isDataLoaded = false; // Flag to track if data has been loaded

// DOM elements
const elements = {
    areaDropdown: document.getElementById('area'),
    zipDropdown: document.getElementById('zipcode'),
    dateRangeDropdown: document.getElementById('dateRange'),
    closedStatusCheckbox: document.getElementById('closedStatus'),
    openStatusCheckbox: document.getElementById('openStatus'),
    searchInput: document.getElementById('search'),
    searchButton: document.getElementById('searchBtn'),
    viewImageButton: document.getElementById('viewImage'),
    nextImageButton: document.getElementById('nextImage'),
    shareImageButton: document.getElementById('shareImage'),
    graffitiImage: document.getElementById('graffitiImage'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    errorMessage: document.getElementById('errorMessage'),
    instructionContainer: document.querySelector('.instruction-container'),
    imageControls: document.getElementById('imageControls'),
    zoomInButton: document.getElementById('zoomIn'),
    zoomOutButton: document.getElementById('zoomOut'),
    resetZoomButton: document.getElementById('resetZoom'),
    shareModal: document.getElementById('shareModal'),
    closeModalButton: document.querySelector('.close'),
    shareLinkInput: document.getElementById('shareLink'),
    copyLinkButton: document.getElementById('copyLink'),
    totalRequestsElement: document.getElementById('totalRequests'),
    avgResolutionTimeElement: document.getElementById('avgResolutionTime'),
    statusCountsElement: document.getElementById('statusCounts'),
    tryAgainButton: document.getElementById('tryAgainButton'),
    randomStartButton: document.getElementById('randomStartButton'),
    mobileTabs: document.querySelectorAll('.mobile-tab')
};

// Load data with better error handling
window.addEventListener('DOMContentLoaded', function() {
    showLoadingScreen();
    
    Promise.all([
        fetch('https://raw.githubusercontent.com/jeisey/phiti/main/ref_ziparea.csv')
            .then(handleResponse)
            .then(processReferenceData)
            .catch(handleError),
        
        fetch('https://raw.githubusercontent.com/jeisey/phiti/main/graffiti.csv')
            .then(handleResponse)
            .then(processGraffitiData)
            .catch(handleError)
    ])
    .then(() => {
        // Calculate and display stats
        updateStats();
        
        // Initialize UI states
        initializeUIState();
        
        isDataLoaded = true;
        hideLoadingScreen();
        
        console.log('All data loaded successfully');
        
        // Check for shared image URL parameters
        checkForSharedImage();
    })
    .catch((error) => {
        console.error('Failed to load application data:', error);
        hideLoadingScreen();
        showErrorMessage('Failed to load application data. Please refresh the page or try again later.');
    });
});

// Helper function to show loading screen
function showLoadingScreen() {
    elements.loadingIndicator.classList.remove('hidden');
}

// Helper function to hide loading screen
function hideLoadingScreen() {
    elements.loadingIndicator.classList.add('hidden');
}

// Helper function to handle fetch responses
function handleResponse(response) {
    if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status}`);
    }
    return response.text();
}

// Helper function to handle errors
function handleError(error) {
    console.error('Error loading data:', error);
    // Show error message to user
    showErrorMessage('Failed to load data. Please refresh the page or try again later.');
}

// Process reference data
function processReferenceData(data) {
    const rows = data.trim().split('\n');
    
    // Skip header row if it exists
    const startIndex = rows[0].includes('Zip,District') ? 1 : 0;
    
    // Add default empty option to area dropdown
    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = "All Areas";
    elements.areaDropdown.appendChild(defaultOption);
    
    for (let i = startIndex; i < rows.length; i++) {
        const columns = rows[i].split(',');
        const zipcode = columns[0].trim();
        const area = columns[1].trim();
        
        // Store all unique zip codes
        if (zipcode && !isNaN(zipcode)) {
            allZips.add(zipcode);
        }
        
        if (area) {
            if (!areaToZip[area]) {
                areaToZip[area] = [];
                
                // Create an option for the area
                const option = document.createElement('option');
                option.value = area;
                option.textContent = area;
                elements.areaDropdown.appendChild(option);
            }
            areaToZip[area].push(zipcode);
        }
    }
    
    // Sort zip codes numerically
    allZips = new Set([...allZips].sort((a, b) => parseInt(a) - parseInt(b)));
    
    // Initially populate the zip dropdown with all zip codes
    populateZipDropdown();
}

// Process graffiti data
function processGraffitiData(data) {
    const rows = data.trim().split('\n');
    
    // Skip header row if it exists
    const startIndex = rows[0].includes('cartodb_id') ? 1 : 0;
    
    for (let i = startIndex; i < rows.length; i++) {
        try {
            // Use regular expression to handle commas within quotes
            const columns = parseCSVLine(rows[i]);
            
            // Check if row has enough columns
            if (columns.length < 16) continue;
            
            const zipcode = columns[10].trim();
            const media_url = columns[11].trim();
            const area = columns[15].trim();
            const status = columns[3].trim();
            const requested_datetime = columns[5].trim();
            const closed_datetime = columns[8].trim();
            
            // Calculate days to close
            let time_to_close = "N/A";
            if (columns[14] && !isNaN(columns[14])) {
                time_to_close = columns[14];
            }
            
            if (media_url && zipcode) {
                if (!zipCodeMedia[zipcode]) {
                    zipCodeMedia[zipcode] = [];
                }
                zipCodeMedia[zipcode].push(media_url);
                
                // Store detailed data
                graffitiData.push({
                    id: columns[0],
                    service_request_id: columns[2],
                    zipcode: zipcode,
                    media_url: media_url,
                    area: area,
                    time_to_close: time_to_close,
                    requested_datetime: formatDate(requested_datetime),
                    closed_datetime: formatDate(closed_datetime),
                    address: columns[9],
                    status: status,
                    status_notes: columns[4] || 'No notes provided'
                });
            }
        } catch (error) {
            console.error('Error processing row:', error);
        }
    }
}

// Parse CSV line properly handling commas in quotes
function parseCSVLine(line) {
    const result = [];
    let cell = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(cell);
            cell = '';
        } else {
            cell += char;
        }
    }
    
    // Push the last cell
    result.push(cell);
    
    return result;
}

// Format date strings
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        // Remove timezone part if it exists
        const cleanedDateString = dateString.split('+')[0].trim();
        const date = new Date(cleanedDateString);
        
        if (isNaN(date.getTime())) {
            return dateString; // Return original if parsing fails
        }
        
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString;
    }
}

// Populate zip dropdown based on selected area
function populateZipDropdown(selectedArea) {
    // Clear all existing options
    elements.zipDropdown.innerHTML = '';
    
    // Add a default "All" option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'All Zip Codes';
    elements.zipDropdown.appendChild(defaultOption);
    
    // If an area is selected, filter by the area; otherwise, show all available zip codes
    const zipsToShow = selectedArea ? areaToZip[selectedArea] : Array.from(allZips);
    
    // Sort zip codes
    if (zipsToShow && zipsToShow.length > 0) {
        zipsToShow.sort((a, b) => parseInt(a) - parseInt(b));
        
        zipsToShow.forEach(zip => {
            const option = document.createElement('option');
            option.value = zip;
            option.textContent = zip;
            elements.zipDropdown.appendChild(option);
        });
    }
}

// Update stats display
function updateStats() {
    // Total requests
    const totalRequests = graffitiData.length;
    elements.totalRequestsElement.textContent = totalRequests.toLocaleString();
    
    // Average resolution time
    const closedRequests = graffitiData.filter(item => 
        item.status === 'Closed' && 
        item.time_to_close !== 'N/A' && 
        !isNaN(item.time_to_close)
    );
    
    if (closedRequests.length > 0) {
        const totalDays = closedRequests.reduce((sum, item) => sum + parseInt(item.time_to_close), 0);
        const avgDays = Math.round(totalDays / closedRequests.length);
        elements.avgResolutionTimeElement.textContent = avgDays;
    } else {
        elements.avgResolutionTimeElement.textContent = 'N/A';
    }
    
    // Update status counts
    const closedCount = graffitiData.filter(item => item.status === 'Closed').length;
    const openCount = graffitiData.filter(item => item.status === 'Open').length;
    elements.statusCountsElement.textContent = `(${closedCount}) Closed | (${openCount}) Open`;
}

// Initialize UI state
function initializeUIState() {
    // Set default event listeners
    elements.areaDropdown.addEventListener('change', function() {
        populateZipDropdown(this.value || null);
        resetImageView();
    });
    
    elements.zipDropdown.addEventListener('change', resetImageView);
    elements.dateRangeDropdown.addEventListener('change', resetImageView);
    elements.closedStatusCheckbox.addEventListener('change', resetImageView);
    elements.openStatusCheckbox.addEventListener('change', resetImageView);
    
    elements.viewImageButton.addEventListener('click', loadRandomImage);
    elements.nextImageButton.addEventListener('click', loadNextImage);
    elements.shareImageButton.addEventListener('click', showShareModal);
    elements.randomStartButton.addEventListener('click', loadRandomGraffiti);
    elements.tryAgainButton.addEventListener('click', retryLoadImage);
    
    // Search functionality
    elements.searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => performSearch(this.value), 300);
    });
    
    elements.searchButton.addEventListener('click', function() {
        performSearch(elements.searchInput.value);
    });
    
    // Enter key in search
    elements.searchInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            performSearch(this.value);
        }
    });
    
    // Image controls
    elements.zoomInButton.addEventListener('click', zoomIn);
    elements.zoomOutButton.addEventListener('click', zoomOut);
    elements.resetZoomButton.addEventListener('click', resetZoom);
    
    // Share modal
    elements.closeModalButton.addEventListener('click', closeShareModal);
    elements.copyLinkButton.addEventListener('click', copyShareLink);
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === elements.shareModal) {
            closeShareModal();
        }
    });
    
    // Handle image load errors
    elements.graffitiImage.addEventListener('error', handleImageError);
    
    // Initialize social share buttons
    document.querySelector('.social-button.twitter').addEventListener('click', shareOnTwitter);
    document.querySelector('.social-button.facebook').addEventListener('click', shareOnFacebook);
    document.querySelector('.social-button.email').addEventListener('click', shareViaEmail);
    
    // Mobile tabs functionality
    elements.mobileTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            setActiveTab(targetTab);
        });
    });
}

// Set active tab for mobile view
function setActiveTab(tabName) {
    // Update tab styles
    elements.mobileTabs.forEach(tab => {
        if (tab.getAttribute('data-tab') === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Update section visibility
    const sections = document.querySelectorAll('.mobile-section');
    sections.forEach(section => {
        if (section.getAttribute('data-section') === tabName) {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });
}

// Reset image view when selection changes
function resetImageView() {
    // Reset UI
    elements.graffitiImage.classList.add('hidden');
    elements.instructionContainer.style.display = 'flex';
    elements.nextImageButton.disabled = true;
    elements.shareImageButton.disabled = true;
    elements.imageControls.classList.add('hidden');
    elements.errorMessage.classList.add('hidden');
    
    // Reset zoom
    resetZoom();
    
    // Clear current selection data
    currentImages = [];
    currentImageIndex = -1;
    
    // Clear info fields
    document.getElementById('infoArea').textContent = '';
    document.getElementById('infoZipcode').textContent = '';
    document.getElementById('infoTimeToClose').textContent = '';
    document.getElementById('infoDateReported').textContent = '';
    document.getElementById('infoAddress').textContent = '';
    document.getElementById('infoStatus').textContent = '';
    document.getElementById('infoStatusNotes').textContent = '';
}

// Filter graffiti data based on selection
function filterGraffitiData() {
    const zipCode = elements.zipDropdown.value;
    const area = elements.areaDropdown.value;
    const dateRange = elements.dateRangeDropdown.value;
    const closedStatusChecked = elements.closedStatusCheckbox.checked;
    const openStatusChecked = elements.openStatusCheckbox.checked;
    
    // Filter by area and/or zipcode
    let filtered = [...graffitiData];
    
    if (area) {
        filtered = filtered.filter(item => item.area === area);
    }
    
    if (zipCode) {
        filtered = filtered.filter(item => item.zipcode === zipCode);
    }
    
    // Filter by date range
    if (dateRange !== 'all') {
        const now = new Date();
        let cutoffDate;
        
        switch (dateRange) {
            case 'lastWeek':
                cutoffDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'lastMonth':
                cutoffDate = new Date(now.setMonth(now.getMonth() - 1));
                break;
            case 'last3Months':
                cutoffDate = new Date(now.setMonth(now.getMonth() - 3));
                break;
            case 'lastYear':
                cutoffDate = new Date(now.setFullYear(now.getFullYear() - 1));
                break;
        }
        
        filtered = filtered.filter(item => {
            if (item.requested_datetime === 'N/A') return false;
            const requestDate = new Date(item.requested_datetime);
            return requestDate >= cutoffDate;
        });
    }
    
    // Filter by status
    filtered = filtered.filter(item => {
        if (closedStatusChecked && item.status === 'Closed') return true;
        if (openStatusChecked && item.status === 'Open') return true;
        return false;
    });
    
    return filtered;
}

// Load random graffiti without filters
function loadRandomGraffiti() {
    // Reset any filters
    elements.areaDropdown.value = '';
    elements.zipDropdown.value = '';
    elements.dateRangeDropdown.value = 'all';
    elements.closedStatusCheckbox.checked = true;
    elements.openStatusCheckbox.checked = true;
    
    // Populate zip dropdown with all areas
    populateZipDropdown();
    
    // Load image
    loadRandomImage();
}

// Load a random image based on current filters
function loadRandomImage() {
    // Show loading indicator
    elements.loadingIndicator.classList.remove('hidden');
    elements.errorMessage.classList.add('hidden');
    elements.instructionContainer.style.display = 'none';
    
    // Get filtered data
    const filteredData = filterGraffitiData();
    
    // Update status counts for current filter
    const closedCount = filteredData.filter(img => img.status === 'Closed').length;
    const openCount = filteredData.filter(img => img.status === 'Open').length;
    elements.statusCountsElement.textContent = `(${closedCount}) Closed | (${openCount}) Open`;
    
    // Check if we have results
    if (filteredData.length === 0) {
        elements.loadingIndicator.classList.add('hidden');
        showErrorMessage('No graffiti images match your filters. Please adjust your criteria and try again.');
        return;
    }
    
    // Store current filtered results for "Next" functionality
    currentImages = filteredData;
    
    // Get a random image from the filtered results
    currentImageIndex = Math.floor(Math.random() * currentImages.length);
    displayCurrentImage();
}

// Retry loading the current image
function retryLoadImage() {
    elements.errorMessage.classList.add('hidden');
    
    if (currentImages.length > 0 && currentImageIndex >= 0) {
        elements.loadingIndicator.classList.remove('hidden');
        displayCurrentImage();
    } else {
        loadRandomImage();
    }
}

// Display the current image
function displayCurrentImage() {
    if (currentImages.length === 0 || currentImageIndex < 0) {
        elements.loadingIndicator.classList.add('hidden');
        showErrorMessage('No image selected. Please try different filters.');
        return;
    }
    
    const currentEntry = currentImages[currentImageIndex];
    
    // Hide instructions and show image
    elements.instructionContainer.style.display = 'none';
    
    // Reset zoom
    resetZoom();
    
    // Set image source
    elements.graffitiImage.src = currentEntry.media_url;
    
    // When image loads successfully
    elements.graffitiImage.onload = function() {
        // Hide loading indicator and show image
        elements.loadingIndicator.classList.add('hidden');
        elements.graffitiImage.classList.remove('hidden');
        elements.imageControls.classList.remove('hidden');
        
        // Enable next and share buttons
        elements.nextImageButton.disabled = false;
        elements.shareImageButton.disabled = false;
        
        // Update info details
        document.getElementById('infoArea').textContent = currentEntry.area || 'N/A';
        document.getElementById('infoZipcode').textContent = currentEntry.zipcode || 'N/A';
        document.getElementById('infoTimeToClose').textContent = currentEntry.time_to_close || 'N/A';
        document.getElementById('infoDateReported').textContent = currentEntry.requested_datetime || 'N/A';
        document.getElementById('infoAddress').textContent = currentEntry.address || 'N/A';
        document.getElementById('infoStatus').textContent = currentEntry.status || 'N/A';
        document.getElementById('infoStatusNotes').textContent = currentEntry.status_notes || 'No notes provided';
        
        // Switch to info tab on mobile
        if (window.innerWidth <= 768) {
            setActiveTab('info');
        }
    };
}

// Load the next image from current filtered results
function loadNextImage() {
    if (currentImages.length <= 1) {
        return;
    }
    
    // Show loading indicator
    elements.loadingIndicator.classList.remove('hidden');
    elements.graffitiImage.classList.add('hidden');
    
    // Get next image index
    currentImageIndex = (currentImageIndex + 1) % currentImages.length;
    
    // Display the image
    displayCurrentImage();
}

// Handle image loading errors
function handleImageError() {
    elements.loadingIndicator.classList.add('hidden');
    elements.graffitiImage.classList.add('hidden');
    
    showErrorMessage('Unable to load the image. The image may no longer be available.');
    
    // If we have more images, enable the next button
    if (currentImages.length > 1) {
        elements.nextImageButton.disabled = false;
    }
}

// Show error message
function showErrorMessage(message) {
    const errorElement = document.querySelector('#errorMessage p');
    if (errorElement) {
        errorElement.textContent = message;
    }
    elements.errorMessage.classList.remove('hidden');
}

// Search functionality
function performSearch(searchTerm) {
    if (!searchTerm.trim()) {
        return;
    }
    
    // Show loading indicator
    elements.loadingIndicator.classList.remove('hidden');
    elements.errorMessage.classList.add('hidden');
    elements.instructionContainer.style.display = 'none';
    
    searchTerm = searchTerm.trim().toLowerCase();
    
    // Reset filters
    elements.areaDropdown.value = '';
    elements.zipDropdown.value = '';
    
    // Filter data based on search term
    const searchResults = graffitiData.filter(item => 
        (item.area && item.area.toLowerCase().includes(searchTerm)) ||
        (item.address && item.address.toLowerCase().includes(searchTerm)) ||
        (item.zipcode && item.zipcode.toLowerCase().includes(searchTerm))
    );
    
    if (searchResults.length === 0) {
        elements.loadingIndicator.classList.add('hidden');
        showErrorMessage('No results found for your search. Please try different terms.');
        return;
    }
    
    // Store results and show first image
    currentImages = searchResults;
    currentImageIndex = 0;
    
    // Update status counts for search results
    const closedCount = searchResults.filter(img => img.status === 'Closed').length;
    const openCount = searchResults.filter(img => img.status === 'Open').length;
    elements.statusCountsElement.textContent = `Found: ${searchResults.length} | (${closedCount}) Closed | (${openCount}) Open`;
    
    // Display image
    displayCurrentImage();
}

// Zoom functionality
function zoomIn() {
    imageScale += 0.1;
    if (imageScale > 3) imageScale = 3; // Max zoom limit
    applyZoom();
}

function zoomOut() {
    imageScale -= 0.1;
    if (imageScale < 0.5) imageScale = 0.5; // Min zoom limit
    applyZoom();
}

function resetZoom() {
    imageScale = 1;
    applyZoom();
}

function applyZoom() {
    elements.graffitiImage.style.transform = `scale(${imageScale})`;
}

// Share functionality
function showShareModal() {
    if (currentImages.length === 0 || currentImageIndex < 0) {
        return;
    }
    
    const currentEntry = currentImages[currentImageIndex];
    
    // Generate share URL with query parameters
    const shareUrl = new URL(window.location.href);
    shareUrl.search = '';
    const params = new URLSearchParams();
    params.append('id', currentEntry.id || '');
    params.append('zip', currentEntry.zipcode || '');
    params.append('area', currentEntry.area || '');
    shareUrl.search = params.toString();
    
    // Update share link input
    elements.shareLinkInput.value = shareUrl.toString();
    
    // Show modal
    elements.shareModal.classList.remove('hidden');
}

function closeShareModal() {
    elements.shareModal.classList.add('hidden');
}

function copyShareLink() {
    elements.shareLinkInput.select();
    document.execCommand('copy');
    
    // Show feedback
    const originalText = elements.copyLinkButton.innerHTML;
    elements.copyLinkButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
    
    setTimeout(() => {
        elements.copyLinkButton.innerHTML = originalText;
    }, 2000);
}

// Social sharing
function shareOnTwitter() {
    const url = encodeURIComponent(elements.shareLinkInput.value);
    const text = encodeURIComponent('Check out this graffiti in Philadelphia on Phiti!');
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
}

function shareOnFacebook() {
    const url = encodeURIComponent(elements.shareLinkInput.value);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
}

function shareViaEmail() {
    const url = elements.shareLinkInput.value;
    const subject = encodeURIComponent('Philadelphia Graffiti on Phiti');
    const body = encodeURIComponent(`Check out this graffiti I found on Phiti: ${url}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
}

// Check for shared image URL parameters
function checkForSharedImage() {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedId = urlParams.get('id');
    
    if (sharedId && isDataLoaded) {
        // Find the shared image
        const sharedImage = graffitiData.find(item => item.id === sharedId);
        
        if (sharedImage) {
            // Set dropdowns to match image
            if (sharedImage.area) {
                elements.areaDropdown.value = sharedImage.area;
                populateZipDropdown(sharedImage.area);
            }
            
            if (sharedImage.zipcode) {
                elements.zipDropdown.value = sharedImage.zipcode;
            }
            
            // Set appropriate status checkbox
            elements.closedStatusCheckbox.checked = sharedImage.status === 'Closed';
            elements.openStatusCheckbox.checked = sharedImage.status === 'Open';
            
            // Load filtered results
            const filteredData = filterGraffitiData();
            currentImages = filteredData;
            
            // Find index of the shared image
            currentImageIndex = currentImages.findIndex(item => item.id === sharedId);
            
            if (currentImageIndex >= 0) {
                displayCurrentImage();
            } else {
                // If not found in filtered results, show directly
                currentImages = [sharedImage];
                currentImageIndex = 0;
                displayCurrentImage();
            }
        }
    }
}
