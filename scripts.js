// Global variables and state
let markdownEditor;
let markdownPreview;
let currentPath = '';
const documentState = {
    currentFilePath: null,
    hasChanges: false,
    lastSavedContent: '',
    isNewDocument: true
};

// Function to update preview
function updatePreview() {
    const markdownText = markdownEditor.value;
    markdownPreview.innerHTML = marked.parse(markdownText);
}

// Function to check if content should be saved
function shouldSave(content) {
    return content.trim().length > 0;
}

// Function to extract title from content
function extractTitle(content) {
    if (!content.trim()) return null;
    
    // Try to find the first header
    const headerMatch = content.match(/^#\s+(.+)$/m);
    if (headerMatch) {
        return headerMatch[1].trim();
    }
    
    // If no header, use first few words (max 5)
    const words = content.trim().split(/\s+/).slice(0, 5);
    return words.join(' ');
}

// Function to debounce
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        const later = function() {
            timeout = null;
            func.apply(context, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Function to prompt for saving changes
function promptSaveChanges() {
    return new Promise((resolve) => {
        const content = markdownEditor.value;
        
        // Don't prompt if it's a new empty document
        if (documentState.isNewDocument && !shouldSave(content)) {
            resolve('discard');
            return;
        }
        
        Swal.fire({
            title: 'Save changes?',
            text: 'Your changes will be lost if you don\'t save them.',
            icon: 'question',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'Save',
            denyButtonText: 'Don\'t save',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                saveDocument()
                    .then(() => resolve('saved'))
                    .catch(() => resolve('cancel'));
            } else if (result.isDenied) {
                resolve('discard');
            } else {
                resolve('cancel');
            }
        });
    });
}

// Function to create new document
function newDocument() {
    console.log('New document requested'); // Debug
    // If there are changes, prompt to save
    if (documentState.hasChanges && shouldSave(markdownEditor.value)) {
        promptSaveChanges().then(result => {
            if (result !== 'cancel') {
                resetDocument();
            }
        });
    } else {
        resetDocument();
    }
    markdownEditor.focus();
}

// Function to reset document state
function resetDocument() {
    console.log('Resetting document state'); // Debug
    documentState.currentFilePath = null;
    documentState.hasChanges = false;
    documentState.lastSavedContent = '';
    documentState.isNewDocument = true;
    markdownEditor.value = '';
    updatePreview();
    console.log('New document state:', documentState); // Debug
}

// Function to handle content changes
function handleContentChange() {
    const content = markdownEditor.value;
    updatePreview();
    
    // Don't mark empty new documents as changed
    if (documentState.isNewDocument && !content.trim()) {
        documentState.hasChanges = false;
        return;
    }
    
    if (content !== documentState.lastSavedContent) {
        documentState.hasChanges = true;
        
        // Auto-save for existing documents
        if (!documentState.isNewDocument) {
            autoSave();
        }
    } else {
        documentState.hasChanges = false;
    }
}

// Auto-save debounced function
const autoSave = debounce(() => {
    if (!documentState.isNewDocument && documentState.hasChanges) {
        saveDocument().catch(error => {
            console.error('Auto-save failed:', error);
            // Don't show popup for auto-save failures
            documentState.hasChanges = true; // Keep the changes flag true
        });
    }
}, 1000);

// Function to save document
function saveDocument(forcePath = null) {
    return new Promise((resolve, reject) => {
        const content = markdownEditor.value;
        
        // Don't save empty documents
        if (!shouldSave(content)) {
            reject(new Error('Cannot save empty document'));
            return;
        }
        
        // If we have a current file path or a forced path, use that
        let path = forcePath || documentState.currentFilePath;
        
        // Only generate filename for new documents without a path
        if (!path && documentState.isNewDocument) {
            const title = extractTitle(content);
            if (!title) {
                reject(new Error('Cannot save document without content'));
                return;
            }
            path = currentPath ? `${currentPath}/${title}.md` : `${title}.md`;
        }
        
        fetch('file_operations.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'save',
                filename: path,
                content: content
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            
            documentState.currentFilePath = data.path;
            documentState.lastSavedContent = content;
            documentState.hasChanges = false;
            documentState.isNewDocument = false;
            
            loadFiles(currentPath);
            loadRecentModifiedFiles(); // Refresh recent files after save
            resolve(data);
        })
        .catch(error => {
            console.error('Error saving:', error);
            // Only show error popup for manual saves, not auto-saves
            if (forcePath !== null) {
                Swal.fire('Error', 'Failed to save: ' + error.message, 'error');
            }
            reject(error);
        });
    });
}

// Function to format timestamp
function formatTimestamp(timestamp) {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now - date;
    
    // If less than 24 hours ago, show relative time
    if (diff < 24 * 60 * 60 * 1000) {
        if (diff < 60 * 1000) return 'just now';
        if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`;
        return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
    }
    
    // If this year, show month and day
    if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    
    // Otherwise show full date
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Function to load files into the file list
function loadFiles(path = '') {
    currentPath = path;
    const fileList = document.getElementById('file-list');
    fileList.innerHTML = '';
    
    // Add back button if in a subfolder
    if (path) {
        const backButton = document.createElement('button');
        backButton.className = 'list-group-item';
        backButton.innerHTML = '<i class="fas fa-arrow-left"></i> Back';
        backButton.addEventListener('click', () => {
            const parentPath = path.split('/').slice(0, -1).join('/');
            loadFiles(parentPath);
        });
        fileList.appendChild(backButton);
    }

    fetch('file_operations.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'list',
            path: path
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        data.items.forEach(item => {
            const listItem = document.createElement('button');
            listItem.className = 'list-group-item';
            
            const itemContent = document.createElement('div');
            const nameSpan = document.createElement('span');
            nameSpan.className = 'file-name';
            
            const icon = document.createElement('i');
            icon.className = item.type === 'directory' ? 'fas fa-folder' : 'fas fa-file-alt';
            
            const timeSpan = document.createElement('small');
            timeSpan.className = 'file-time';
            timeSpan.textContent = formatTimestamp(item.lastModified);
            
            nameSpan.appendChild(icon);
            nameSpan.appendChild(document.createTextNode(' ' + item.name));
            itemContent.appendChild(nameSpan);
            itemContent.appendChild(timeSpan);
            listItem.appendChild(itemContent);
            
            if (item.type === 'directory') {
                listItem.addEventListener('click', () => loadFiles(item.path));
            } else {
                listItem.addEventListener('click', () => {
                    loadFileContent(item.path);
                    // Save last opened file
                    localStorage.setItem('lastOpenedFile', item.path);
                });
            }
            
            // Add delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-danger';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteItem(item);
            });
            listItem.appendChild(deleteBtn);
            
            fileList.appendChild(listItem);
        });
    })
    .catch(error => {
        console.error('Error loading files:', error);
        Swal.fire('Error', 'Failed to load files: ' + error.message, 'error');
    });
}

// Function to load file content
function loadFileContent(filename) {
    fetch('file_operations.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'load',
            filename: filename
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        markdownEditor.value = data.content;
        documentState.currentFilePath = filename;
        documentState.lastSavedContent = data.content;
        documentState.hasChanges = false;
        documentState.isNewDocument = false;
        updatePreview();
    })
    .catch(error => {
        console.error('Error loading:', error);
        Swal.fire('Error', 'Failed to load file: ' + error.message, 'error');
    });
}

// Function to delete item (file or folder)
function deleteItem(item) {
    const message = item.type === 'directory' 
        ? 'This will delete the folder and all its contents.'
        : 'This will delete the file permanently.';
        
    Swal.fire({
        title: 'Are you sure?',
        text: message,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
        if (result.isConfirmed) {
            const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;
            
            fetch('file_operations.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete',
                    path: itemPath,
                    type: item.type
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                
                // If we deleted the current file, create new document
                if (item.type !== 'directory' && 
                    itemPath === documentState.currentFilePath) {
                    resetDocument();
                }
                
                loadFiles(currentPath);
                Swal.fire('Deleted!', 'The item has been deleted.', 'success');
            })
            .catch(error => {
                Swal.fire('Error', 'Failed to delete: ' + error.message, 'error');
            });
        }
    });
}

// Function to create folder
function createFolder() {
    Swal.fire({
        title: 'Create Folder',
        input: 'text',
        inputLabel: 'Folder Name',
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value) return 'Please enter a folder name';
            if (value.includes('/')) return 'Folder name cannot contain "/"';
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const folderName = result.value;
            const folderPath = currentPath ? `${currentPath}/${folderName}` : folderName;
            
            fetch('file_operations.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'createFolder',
                    path: folderPath
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                loadFiles(currentPath);
                Swal.fire('Success', 'Folder created successfully!', 'success');
            })
            .catch(error => {
                Swal.fire('Error', 'Failed to create folder: ' + error.message, 'error');
            });
        }
    });
}

// Function to load recent modified files
async function loadRecentModifiedFiles() {
    try {
        const response = await fetch('file_operations.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'get_recent_modified'
            })
        });

        if (!response.ok) {
            throw new Error('Failed to load recent files');
        }

        const data = await response.json();
        if (data.success && data.files) {
            const recentFilesList = document.getElementById('recent-files-list');
            recentFilesList.innerHTML = '';
            
            if (data.files.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.className = 'empty-recent-files';
                emptyMessage.textContent = 'No recently modified files';
                recentFilesList.appendChild(emptyMessage);
                return;
            }
            
            data.files.forEach(file => {
                const fileItem = document.createElement('div');
                fileItem.className = 'recent-file-item';
                
                const mainContent = document.createElement('div');
                mainContent.className = 'recent-file-main';
                
                const fileLink = document.createElement('div');
                fileLink.className = 'recent-file-name';
                fileLink.textContent = file.filename;
                
                const timeSpan = document.createElement('div');
                timeSpan.className = 'recent-file-time';
                timeSpan.textContent = formatTimestamp(new Date(file.modified_at));
                
                mainContent.appendChild(fileLink);
                mainContent.appendChild(timeSpan);
                fileItem.appendChild(mainContent);
                
                // Add preview directly under the main content
                const preview = document.createElement('div');
                preview.className = 'recent-file-preview';
                preview.textContent = file.preview;
                fileItem.appendChild(preview);
                
                // Make the entire item clickable
                fileItem.addEventListener('click', (e) => {
                    e.preventDefault();
                    loadFileContent(file.filename);
                });
                
                recentFilesList.appendChild(fileItem);
            });
        }
    } catch (error) {
        console.error('Error loading recent files:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    markdownEditor = document.getElementById('markdown-editor');
    markdownPreview = document.getElementById('markdown-preview');
    const toggleFilePanelButton = document.getElementById('toggle-file-panel');
    const themeSwitcherButton = document.getElementById('theme-switcher');
    const createFolderButton = document.getElementById('create-folder');
    const saveButton = document.getElementById('save-note');
    const newFileButton = document.getElementById('new-file');
    
    console.log('Initial setup - Buttons found:', { 
        save: saveButton,
        newFile: newFileButton,
        createFolder: createFolderButton
    }); // Debug
    
    // Set up the input event listener
    markdownEditor.addEventListener('input', handleContentChange);
    
    // Load both file list and recent files initially
    loadFiles('');
    loadRecentModifiedFiles();
    
    // Refresh both when file panel is toggled
    toggleFilePanelButton.addEventListener('click', () => {
        loadFiles(currentPath);
        loadRecentModifiedFiles();
    });
    
    // Add create folder button listener
    if (createFolderButton) {
        createFolderButton.addEventListener('click', createFolder);
    }
    
    // Add new file button listener
    if (newFileButton) {
        console.log('Setting up new file button'); // Debug
        newFileButton.addEventListener('click', newDocument);
    } else {
        console.error('New file button not found in the DOM');
    }
    
    // Add save button listener - fresh implementation
    if (saveButton) {
        saveButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Save button clicked');
            console.log('Current state:', documentState);
            
            // Only proceed if this is a new document
            if (!documentState.isNewDocument) {
                console.log('Not a new document - ignoring save button');
                return;
            }
            
            const content = markdownEditor.value;
            if (!content || !content.trim()) {
                console.log('No content to save');
                return;
            }
            
            // Get title from header or first words
            const title = extractTitle(content);
            if (!title) {
                console.log('Could not extract title');
                return;
            }
            
            // Create the file path
            const filePath = currentPath ? `${currentPath}/${title}.md` : `${title}.md`;
            console.log('Will create file:', filePath);
            
            // Save the new file
            fetch('file_operations.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save',
                    filename: filePath,
                    content: content
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                
                // Update state
                documentState.currentFilePath = filePath;
                documentState.lastSavedContent = content;
                documentState.hasChanges = false;
                documentState.isNewDocument = false;                
                loadFiles(currentPath);
                loadRecentModifiedFiles(); // Refresh recent files after save
            })
            .catch(error => {
                console.error('Save failed:', error);
                Swal.fire('Error', 'Failed to save: ' + error.message, 'error');
            });
        });
        
        console.log('Save button handler attached');
    }
    
    // Layout toggle functionality
    const toggleLayoutButton = document.getElementById('toggle-layout');
    const editorContainer = document.getElementById('editor-container');
    let currentLayout = localStorage.getItem('layout') || 'normal'; // Get saved layout preference

    // Function to update layout
    function updateLayout(newLayout) {
        // Remove previous classes
        editorContainer.classList.remove('editor-only', 'preview-only');
        
        // Update layout based on new state
        if (newLayout === 'editor-only') {
            editorContainer.classList.add('editor-only');
            toggleLayoutButton.setAttribute('data-mode', 'editor-only');
            toggleLayoutButton.title = 'Show Preview Only';
        } else if (newLayout === 'preview-only') {
            editorContainer.classList.add('preview-only');
            toggleLayoutButton.setAttribute('data-mode', 'preview-only');
            toggleLayoutButton.title = 'Show Both Panels';
        } else {
            toggleLayoutButton.removeAttribute('data-mode');
            toggleLayoutButton.title = 'Show Editor Only';
        }
        
        // Save preference
        localStorage.setItem('layout', newLayout);
        currentLayout = newLayout;
    }

    // Set initial layout
    updateLayout(currentLayout);

    toggleLayoutButton.addEventListener('click', () => {
        const layouts = {
            'normal': 'editor-only',
            'editor-only': 'preview-only',
            'preview-only': 'normal'
        };
        updateLayout(layouts[currentLayout]);
    });

    // Theme handling
    let currentTheme = localStorage.getItem('theme') || 'light';
    
    function setTheme(theme) {
        document.body.classList.remove('light', 'dark', 'sepia');
        document.body.classList.add(theme);
        localStorage.setItem('theme', theme);
        currentTheme = theme;
        
        // Update theme icon
        const themeIcon = themeSwitcherButton.querySelector('i');
        themeIcon.className = theme === 'light' ? 'fas fa-moon' : 
                             theme === 'dark' ? 'fas fa-sun' : 
                             'fas fa-book';
    }
    
    // Theme switcher
    themeSwitcherButton.addEventListener('click', () => {
        const themes = ['light', 'dark', 'sepia'];
        const currentIndex = themes.indexOf(currentTheme);
        const nextTheme = themes[(currentIndex + 1) % themes.length];
        setTheme(nextTheme);
    });
    
    // Set initial theme from localStorage or default to 'light'
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    // File panel toggle
    const filePanel = document.getElementById('file-panel');
    
    toggleFilePanelButton.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            // Mobile view - use transform
            filePanel.classList.toggle('show');
            const icon = toggleFilePanelButton.querySelector('i');
            icon.classList.toggle('fa-chevron-left');
            icon.classList.toggle('fa-chevron-right');
        } else {
            // Desktop view - use display
            filePanel.style.display = filePanel.style.display === 'none' ? 'flex' : 'none';
            const icon = toggleFilePanelButton.querySelector('i');
            icon.classList.toggle('fa-chevron-left');
            icon.classList.toggle('fa-chevron-right');
        }
    });
    
    // Close file panel when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && 
            !filePanel.contains(e.target) && 
            !toggleFilePanelButton.contains(e.target) &&
            filePanel.classList.contains('show')) {
            filePanel.classList.remove('show');
            const icon = toggleFilePanelButton.querySelector('i');
            icon.classList.add('fa-chevron-left');
            icon.classList.remove('fa-chevron-right');
        }
    });
    
    // Load last opened file on startup
    const lastOpenedFile = localStorage.getItem('lastOpenedFile');
    if (lastOpenedFile) {
        loadFileContent(lastOpenedFile);
    }
    
    // Handle recent files dropdown
    const recentFilesBtn = document.getElementById('recent-files-btn');
    const recentFilesDropdown = document.getElementById('recent-files-dropdown');
    
    // Toggle dropdown on button click
    recentFilesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        recentFilesDropdown.classList.toggle('show');
        if (recentFilesDropdown.classList.contains('show')) {
            loadRecentModifiedFiles();
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!recentFilesDropdown.contains(e.target) && !recentFilesBtn.contains(e.target)) {
            recentFilesDropdown.classList.remove('show');
        }
    });
    
    // Update loadRecentModifiedFiles function
    async function loadRecentModifiedFiles() {
        try {
            const response = await fetch('file_operations.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'get_recent_modified'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to load recent files');
            }

            const data = await response.json();
            if (data.success && data.files) {
                const recentFilesList = document.getElementById('recent-files-list');
                recentFilesList.innerHTML = '';
                
                if (data.files.length === 0) {
                    const emptyMessage = document.createElement('div');
                    emptyMessage.className = 'empty-recent-files';
                    emptyMessage.textContent = 'No recently modified files';
                    recentFilesList.appendChild(emptyMessage);
                    return;
                }
                
                data.files.forEach(file => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'recent-file-item';
                    
                    const mainContent = document.createElement('div');
                    mainContent.className = 'recent-file-main';
                    
                    const fileLink = document.createElement('div');
                    fileLink.className = 'recent-file-name';
                    fileLink.textContent = file.filename;
                    
                    const timeSpan = document.createElement('div');
                    timeSpan.className = 'recent-file-time';
                    timeSpan.textContent = formatTimestamp(new Date(file.modified_at));
                    
                    mainContent.appendChild(fileLink);
                    mainContent.appendChild(timeSpan);
                    fileItem.appendChild(mainContent);
                    
                    // Add preview directly under the main content
                    const preview = document.createElement('div');
                    preview.className = 'recent-file-preview';
                    preview.textContent = file.preview;
                    fileItem.appendChild(preview);
                    
                    // Make the entire item clickable
                    fileItem.addEventListener('click', (e) => {
                        e.preventDefault();
                        loadFileContent(file.filename);
                    });
                    
                    recentFilesList.appendChild(fileItem);
                });
            }
        } catch (error) {
            console.error('Error loading recent files:', error);
        }
    }
});