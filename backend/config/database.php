<?php
// backend/config/database.php
declare(strict_types=1);

class Database {
    private static ?PDO $instance = null;

    public static function getConnection(): PDO {
        if (self::$instance === null) {
            $host = getenv('DB_HOST') ?: 'localhost';
            $port = getenv('DB_PORT') ?: '3306';
            $dbName = getenv('DB_NAME') ?: 'u868013330_cheran';
            $user = getenv('DB_USER') ?: 'u868013330_cheran';
            $password = getenv('DB_PASSWORD') ?: 'nMX8L9HJeseFHfC@';

            try {
                $dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4";
                self::$instance = new PDO($dsn, $user, $password, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
                ]);
            } catch (PDOException $e) {
                // If MySQL is not currently running or database not created yet, log and throw clean API exception
                error_log("Database connection error: " . $e->getMessage());
                throw new Exception("Database connection unavailable: " . $e->getMessage(), 500);
            }
        }
        return self::$instance;
    }
}
