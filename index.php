<?php
include 'auth.php';

// Redirect to login page if not authenticated
if (!isLoggedIn()) {
    header('Location: login.php');
    exit();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Minimal.md - A beautiful markdown editor">
    <title>Minimal.md</title>
    
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
    
    <!-- Styles -->
    <link rel="stylesheet" href="styles.css">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <!-- Favicon -->
    <link rel="icon" type="image/png" href="favicon.png">
    
    <style>
        body, html {
            height: 100%;
        }
        #main-content {
            display: flex;
            height: calc(100vh - 56px);
        }
        #file-panel {
            width: 250px;
            background-color: #f8f9fa;
            padding: 10px;
            overflow-y: auto;
        }
        #editor-container {
            display: flex;
            flex: 1;
        }
        #editor-panel, #preview-panel {
            flex: 1;
            padding: 10px;
            overflow-y: auto;
        }
        #markdown-editor {
            width: 100%;
            height: 100%;
            resize: none;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-family: monospace;
        }
        #markdown-preview {
            padding: 20px;
            border: 1px solid #ccc;
            border-radius: 4px;
            height: 100%;
            overflow-y: auto;
            line-height: 1.6;
        }
        #markdown-preview h1,
        #markdown-preview h2,
        #markdown-preview h3,
        #markdown-preview h4,
        #markdown-preview h5,
        #markdown-preview h6 {
            margin-top: 1em;
            margin-bottom: 0.5em;
        }
        #markdown-preview p {
            margin-bottom: 1em;
        }
        #markdown-preview code {
            background-color: #f5f5f5;
            padding: 0.2em 0.4em;
            border-radius: 3px;
        }
        #markdown-preview pre {
            background-color: #f5f5f5;
            padding: 1em;
            border-radius: 4px;
            overflow-x: auto;
        }
        #markdown-preview blockquote {
            border-left: 4px solid #ddd;
            padding-left: 1em;
            margin-left: 0;
            color: #666;
        }
        #markdown-preview ul,
        #markdown-preview ol {
            padding-left: 2em;
            margin-bottom: 1em;
        }
        #controls button {
            background: none;
            border: none;
            color: #333;
            font-size: 1.5em;
            cursor: pointer;
            margin-left: 10px;
        }
        #controls button:hover {
            color: #007bff;
        }
        .list-group-item {
            cursor: pointer;
        }
        .list-group-item:hover {
            background-color: #f0f0f0;
        }
    </style>
</head>
<body>
    <div id="app">
        <div id="top-bar">
            <div class="app-brand">
                <span id="app-name">Minimal.md</span>
            </div>
            <div class="toolbar">
                <button id="toggle-file-panel" title="Toggle File Panel">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <button id="toggle-layout" title="Toggle Layout">
                    <i class="fas fa-columns"></i>
                </button>
                <button id="recent-files-btn" title="Recent Files">
                    <i class="fas fa-history"></i>
                </button>
                <div id="recent-files-dropdown" class="dropdown-menu">
                    <h3>Recently Modified</h3>
                    <div id="recent-files-list">
                        <!-- Recent files will be populated here by JavaScript -->
                    </div>
                </div>
                <button id="theme-switcher" title="Switch Theme">
                    <i class="fas fa-moon"></i>
                </button>
                <button id="logout" title="Logout" onclick="window.location.href='logout.php'">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            </div>
        </div>
        <div id="main-content">
            <div id="file-panel">
                <div class="panel-section">
                    <div id="file-toolbar">
                        <button id="create-note" title="Create New Note">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button id="save-note" title="Save Note">
                            <i class="fas fa-save"></i>
                        </button>
                        <button id="create-folder" title="Create New Folder">
                            <i class="fas fa-folder-plus"></i>
                        </button>
                    </div>
                    <div id="file-list">
                        <!-- Files will be loaded here -->
                    </div>
                </div>
            </div>
            <div id="editor-container">
                <div id="editor-panel">
                    <textarea id="markdown-editor" placeholder="Start writing..."></textarea>
                </div>
                <div id="preview-panel">
                    <div id="markdown-preview"></div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script>
        // Initialize marked immediately after loading
        marked.use({
            gfm: true,
            breaks: true
        });
    </script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11.7.12/dist/sweetalert2.all.min.js"></script>
    <script src="scripts.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('create-note').addEventListener('click', function() {
                newDocument();
            });
        });
    </script>
</body>
</html>
