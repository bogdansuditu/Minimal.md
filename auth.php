<?php
if (session_status() === PHP_SESSION_NONE) {
    // Set session cookie parameters before any output
    session_set_cookie_params([
        'lifetime' => 30 * 24 * 60 * 60, // 30 days in seconds
        'path' => '/',
        'httponly' => true,   // Prevent JavaScript access to session cookie
        'samesite' => 'Lax'   // More permissive for local development
    ]);
    
    // Set session garbage collection
    ini_set('session.gc_maxlifetime', 30 * 24 * 60 * 60); // 30 days in seconds
    
    session_start();
}

// Function to generate a secure token
function generateToken() {
    return bin2hex(random_bytes(32));
}

// Function to store remember me token
function storeRememberToken($username) {
    $token = generateToken();
    $tokens = [];
    $tokensFile = 'users/.remember_tokens.json';
    
    if (file_exists($tokensFile)) {
        $tokens = json_decode(file_get_contents($tokensFile), true) ?? [];
    }
    
    // Store token with expiration (30 days)
    $tokens[$username] = [
        'token' => $token,
        'expires' => time() + (30 * 24 * 60 * 60)
    ];
    
    // Ensure no output before setting cookie
    if (headers_sent($filename, $linenum)) {
        error_log("Headers already sent in $filename on line $linenum");
        return false;
    }
    
    // Set remember me cookie first
    if (!setcookie('remember_token', $token, [
        'expires' => time() + (30 * 24 * 60 * 60),
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax'
    ])) {
        error_log("Failed to set remember_token cookie");
        return false;
    }
    
    // Then write to file
    return file_put_contents($tokensFile, json_encode($tokens)) !== false;
}

// Function to verify remember me token
function verifyRememberToken() {
    if (!isset($_COOKIE['remember_token'])) {
        return false;
    }
    
    $tokensFile = 'users/.remember_tokens.json';
    if (!file_exists($tokensFile)) {
        return false;
    }
    
    $tokens = json_decode(file_get_contents($tokensFile), true) ?? [];
    $currentToken = $_COOKIE['remember_token'];
    
    foreach ($tokens as $username => $data) {
        if ($data['token'] === $currentToken && $data['expires'] > time()) {
            $_SESSION['username'] = $username;
            return true;
        }
    }
    
    return false;
}

// Function to hash passwords
function hashPassword($password) {
    return password_hash($password, PASSWORD_BCRYPT);
}

// Function to verify password
function verifyPassword($password, $hash) {
    return password_verify($password, $hash);
}

// Function to authenticate user
function authenticateUser($username, $password) {
    $users = json_decode(file_get_contents('users.json'), true);
    if (isset($users[$username]) && verifyPassword($password, $users[$username]['password'])) {
        $_SESSION['username'] = $username;
        storeRememberToken($username); // Always remember for web app
        return true;
    }
    return false;
}

// Function to check if user is logged in
function isLoggedIn() {
    if (isset($_SESSION['username'])) {
        return true;
    }
    
    // Try to authenticate using remember token
    return verifyRememberToken();
}

// Function to logout user
function logout() {
    session_destroy();
}
?>
