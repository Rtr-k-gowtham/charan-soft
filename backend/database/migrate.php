<?php
// backend/database/migrate.php - Database Initialization & Seed Script
declare(strict_types=1);

$host = getenv('DB_HOST') ?: 'localhost';
$port = getenv('DB_PORT') ?: '3306';
$dbName = getenv('DB_NAME') ?: 'cheran_erp';
$user = getenv('DB_USER') ?: 'root';
$password = getenv('DB_PASSWORD') ?: '';

echo "=== Cheran Soft Goods ERP Database Migration ===\n";
echo "Host: {$host}:{$port}\n";
echo "Database: {$dbName}\n";
echo "User: {$user}\n\n";

try {
    // 1. Connect without db to ensure database exists
    $pdo = new PDO("mysql:host={$host};port={$port};charset=utf8mb4", $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
    echo "✔ Database '{$dbName}' ready.\n";

    // 2. Connect to database
    $pdo = new PDO("mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4", $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    // 3. Run schema.sql
    $schemaFile = __DIR__ . '/schema.sql';
    if (file_exists($schemaFile)) {
        echo "Executing schema.sql...\n";
        $schemaSql = file_get_contents($schemaFile);
        $pdo->exec($schemaSql);
        echo "✔ Schema tables created successfully.\n";
    }

    // 4. Run seed.sql
    $seedFile = __DIR__ . '/seed.sql';
    if (file_exists($seedFile)) {
        echo "Executing seed.sql...\n";
        $seedSql = file_get_contents($seedFile);
        $pdo->exec($seedSql);
        echo "✔ Seed data loaded successfully.\n";
    }

    echo "\n🎉 Migration completed successfully!\n";
} catch (Exception $e) {
    echo "❌ Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
