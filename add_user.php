<?php
// Start the session
session_start();

// Function to hash passwords
function hashPassword($password) {
    return password_hash($password, PASSWORD_BCRYPT);
}

// Prompt for username and password
echo "Enter username: ";
$username = trim(fgets(STDIN));

echo "Enter password: ";
$password = trim(fgets(STDIN));

// Hash the password
$hashedPassword = hashPassword($password);

// Load existing users
$usersFile = 'users.json';
$users = file_exists($usersFile) ? json_decode(file_get_contents($usersFile), true) : [];

// Add the new user
$users[$username] = ['password' => $hashedPassword];

// Save the updated users list
file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT));

// Create user directory
$userDir = 'users/' . $username;
if (!is_dir($userDir)) {
    mkdir($userDir, 0777, true);
}

echo "User '$username' added successfully.\n";
?>