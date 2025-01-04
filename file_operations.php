<?php
// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't show errors to client
ini_set('log_errors', 1);     // Log errors
ini_set('error_log', 'php_errors.log');

// Set up error handler
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    $message = "PHP Error [$errno]: $errstr in $errfile on line $errline";
    error_log($message);
    return false; // Allow PHP's internal error handler to run
});

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Set headers
header('Content-Type: application/json');

// Function to log messages
function logMessage($message) {
    $timestamp = date('Y-m-d H:i:s');
    // Enable this if you want to log to a file
    //error_log("[$timestamp] $message\n", 3, 'file_operations.log');
}

// Log initial request info
logMessage("Request started");
logMessage("Session ID: " . session_id());
logMessage("Session data: " . json_encode($_SESSION));

include 'auth.php';

// Function to send JSON response
function sendJsonResponse($data) {
    logMessage("Sending response: " . json_encode($data));
    echo json_encode($data);
    logMessage("Response sent");
    exit();
}

// Function to update recent modified files
function updateRecentModifiedFiles($username, $filename, $content) {
    $recentFilesPath = "users/$username/.recent_modified.json";
    $maxRecentFiles = 10;
    
    // Load existing recent files
    $recentFiles = [];
    if (file_exists($recentFilesPath)) {
        $recentFiles = json_decode(file_get_contents($recentFilesPath), true) ?? [];
    }
    
    // Remove the file if it already exists in the list
    $recentFiles = array_filter($recentFiles, function($item) use ($filename) {
        return $item['filename'] !== $filename;
    });
    
    // Add the file to the beginning of the array with a content preview
    $preview = substr(strip_tags($content), 0, 100); // Get first 100 chars of content
    array_unshift($recentFiles, [
        'filename' => $filename,
        'modified_at' => date('Y-m-d H:i:s'),
        'preview' => $preview
    ]);
    
    // Keep only the most recent files
    $recentFiles = array_slice($recentFiles, 0, $maxRecentFiles);
    
    // Save the updated list
    file_put_contents($recentFilesPath, json_encode($recentFiles, JSON_PRETTY_PRINT));
}

// Function to get recent modified files
function getRecentModifiedFiles($username) {
    $recentFilesPath = "users/$username/.recent_modified.json";
    if (!file_exists($recentFilesPath)) {
        return [];
    }
    return json_decode(file_get_contents($recentFilesPath), true) ?? [];
}

// Check authentication
if (!isLoggedIn()) {
    logMessage("Not authenticated");
    http_response_code(401);
    sendJsonResponse(['error' => 'Not authenticated']);
}

// Get username from session
$username = $_SESSION['username'] ?? null;
if (!$username) {
    logMessage("No username in session");
    http_response_code(401);
    sendJsonResponse(['error' => 'No username in session']);
}

// Base directory for user files
$userDir = 'users/' . $username;
logMessage("User directory: $userDir");

try {
    // Get raw input
    $input = file_get_contents('php://input');
    logMessage("Raw input: $input");
    
    // Parse JSON input
    $data = json_decode($input, true);
    logMessage("Decoded data: " . json_encode($data));
    
    if (!isset($data['action'])) {
        throw new Exception('No action specified');
    }
    
    // Handle the load action
    if ($data['action'] === 'load') {
        if (!isset($data['filename'])) {
            throw new Exception('No filename provided');
        }
        
        $filename = $data['filename'];
        logMessage("Loading file: $filename");
        
        // Add .md extension if not present
        if (!str_ends_with($filename, '.md')) {
            $filename .= '.md';
        }
        
        $filepath = $userDir . '/' . $filename;
        logMessage("Checking file: $filepath");
        
        // Basic file checks first
        if (!file_exists($filepath)) {
            logMessage("File does not exist: $filepath");
            throw new Exception("File not found: $filepath");
        }
        
        if (!is_readable($filepath)) {
            logMessage("File not readable: $filepath");
            throw new Exception("File not readable: $filepath");
        }
        
        logMessage("File exists and is readable");
        
        // Try to read the file
        $content = file_get_contents($filepath);
        if ($content === false) {
            $error = error_get_last();
            logMessage("Failed to read file: " . ($error ? json_encode($error) : 'Unknown error'));
            throw new Exception("Could not read file");
        }
        
        logMessage("File read successfully. Length: " . strlen($content));
        sendJsonResponse(['content' => $content]);
    }
    
    // Handle the list action
    if ($data['action'] === 'list') {
        $path = isset($data['path']) ? trim($data['path'], '/') : '';
        $fullPath = $path ? $userDir . '/' . $path : $userDir;
        
        if (!file_exists($fullPath)) {
            throw new Exception('Directory not found');
        }
        
        $items = [];
        $files = scandir($fullPath);
        
        foreach ($files as $file) {
            if ($file === '.' || $file === '..' || $file === '.DS_Store' || 
                $file === '.recent_modified.json' || $file === '.git') {
                continue;
            }
            
            // Only show markdown files and directories
            if (!is_dir($fullPath . '/' . $file) && !str_ends_with($file, '.md')) {
                continue;
            }
            
            $filePath = $path ? $path . '/' . $file : $file;
            $fullFilePath = $fullPath . '/' . $file;
            
            $items[] = [
                'name' => $file,
                'path' => $filePath,
                'type' => is_dir($fullFilePath) ? 'directory' : 'file',
                'lastModified' => filemtime($fullFilePath)
            ];
        }
        
        // Sort directories first, then files by last modified time in descending order
        usort($items, function($a, $b) {
            if ($a['type'] !== $b['type']) {
                return $a['type'] === 'directory' ? -1 : 1;
            }
            return $b['lastModified'] - $a['lastModified'];
        });
        
        sendJsonResponse(['items' => $items]);
    }
    
    // Handle the save action
    if ($data['action'] === 'save') {
        // Support both old 'path' and new 'filename' parameters
        $filename = isset($data['filename']) ? $data['filename'] : (isset($data['path']) ? $data['path'] : null);
        $content = $data['content'] ?? null;
        
        if (!$filename || !$content) {
            throw new Exception('Missing filename or content for save');
        }
        
        // Ensure it's a markdown file
        if (!str_ends_with($filename, '.md')) {
            $filename .= '.md';
        }
        
        // Create directory structure if needed
        $fullPath = $userDir . '/' . $filename;
        $dirPath = dirname($fullPath);
        if (!file_exists($dirPath)) {
            mkdir($dirPath, 0777, true);
        }
        
        if (file_put_contents($fullPath, $content) === false) {
            throw new Exception('Failed to save file');
        }
        
        // Update recent modified files when saving
        updateRecentModifiedFiles($username, $filename, $content);
        
        sendJsonResponse([
            'path' => $filename,
            'message' => 'File saved successfully'
        ]);
    }
    
    // Handle the delete action
    if ($data['action'] === 'delete') {
        if (!isset($data['path']) || !isset($data['type'])) {
            throw new Exception('Missing path or type for delete');
        }
        
        $path = trim($data['path'], '/');
        $fullPath = $userDir . '/' . $path;
        
        // Ensure the path is within user's directory
        if (!str_starts_with(realpath($fullPath), realpath($userDir))) {
            throw new Exception('Invalid path');
        }
        
        if ($data['type'] === 'directory') {
            if (!is_dir($fullPath)) {
                throw new Exception('Not a directory');
            }
            // Recursively delete directory
            $it = new RecursiveDirectoryIterator($fullPath, RecursiveDirectoryIterator::SKIP_DOTS);
            $files = new RecursiveIteratorIterator($it, RecursiveIteratorIterator::CHILD_FIRST);
            foreach($files as $file) {
                if ($file->isDir()) {
                    rmdir($file->getRealPath());
                } else {
                    unlink($file->getRealPath());
                }
            }
            rmdir($fullPath);
        } else {
            if (!file_exists($fullPath)) {
                throw new Exception('File not found');
            }
            unlink($fullPath);
        }
        
        sendJsonResponse([
            'message' => 'Item deleted successfully'
        ]);
    }
    
    // Handle the createFolder action
    if ($data['action'] === 'createFolder') {
        if (!isset($data['path'])) {
            throw new Exception('Missing path for folder creation');
        }
        
        $path = trim($data['path'], '/');
        $fullPath = $userDir . '/' . $path;
        
        // Ensure the path is within user's directory
        if (!str_starts_with(realpath(dirname($fullPath)), realpath($userDir))) {
            throw new Exception('Invalid path');
        }
        
        if (file_exists($fullPath)) {
            throw new Exception('Folder already exists');
        }
        
        if (!mkdir($fullPath, 0777, true)) {
            throw new Exception('Failed to create folder');
        }
        
        sendJsonResponse([
            'message' => 'Folder created successfully'
        ]);
    }
    
    // Handle the get_recent_modified action
    if ($data['action'] === 'get_recent_modified') {
        $recentFiles = getRecentModifiedFiles($username);
        sendJsonResponse(['success' => true, 'files' => $recentFiles]);
    }
    
    throw new Exception('Invalid action');
    
} catch (Exception $e) {
    logMessage("Error: " . $e->getMessage());
    http_response_code(400);
    sendJsonResponse(['error' => $e->getMessage()]);
} catch (Error $e) {
    logMessage("Fatal Error: " . $e->getMessage());
    http_response_code(500);
    sendJsonResponse(['error' => 'Internal server error']);
}
