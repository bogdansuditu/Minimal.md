<?php
include 'auth.php';  // This will handle session_start()
session_destroy();
setcookie('theme', '', time() - 3600); // Delete theme cookie
header('Location: login.php');
exit();