-- Smart Expense Tracker Database Schema (MySQL)
-- Proposal: Smart Expense Tracker

CREATE DATABASE IF NOT EXISTS `expense_tracker` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `expense_tracker`;

-- Table for Transactions (Income & Expenses)
CREATE TABLE IF NOT EXISTS `transactions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `title` VARCHAR(150) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `type` ENUM('income', 'expense') NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `date` DATE NOT NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_date` (`date`),
    INDEX `idx_type` (`type`),
    INDEX `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for Monthly Budgets
CREATE TABLE IF NOT EXISTS `budgets` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `month_year` VARCHAR(7) NOT NULL UNIQUE, -- Format: YYYY-MM
    `total_budget` DECIMAL(10, 2) NOT NULL,
    `category_budgets` JSON NULL,           -- Optional category-specific caps
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Initial Sample Data for Quick Start
INSERT INTO `budgets` (`month_year`, `total_budget`) 
VALUES (DATE_FORMAT(CURRENT_DATE, '%Y-%m'), 2500.00)
ON DUPLICATE KEY UPDATE `total_budget` = VALUES(`total_budget`);

INSERT INTO `transactions` (`title`, `amount`, `type`, `category`, `date`, `notes`) VALUES
('Monthly Salary', 3500.00, 'income', 'Salary', CURRENT_DATE - INTERVAL 10 DAY, 'Tech Corp monthly base salary'),
('Freelance UI Design', 650.00, 'income', 'Freelance', CURRENT_DATE - INTERVAL 4 DAY, 'Mobile application prototyping client'),
('Apartment Rent', 850.00, 'expense', 'Bills', CURRENT_DATE - INTERVAL 9 DAY, 'Monthly apartment rent payment'),
('Whole Foods Grocery', 142.50, 'expense', 'Food', CURRENT_DATE - INTERVAL 7 DAY, 'Organic veggies, fruits, and pantry essentials'),
('Metro Card Pass', 65.00, 'expense', 'Transport', CURRENT_DATE - INTERVAL 6 DAY, 'Monthly subway transit pass'),
('Udemy Web Dev Course', 24.99, 'expense', 'Education', CURRENT_DATE - INTERVAL 5 DAY, 'FastAPI and Modern JavaScript specialization'),
('High-speed Internet', 59.99, 'expense', 'Bills', CURRENT_DATE - INTERVAL 3 DAY, 'Fiber optic residential broadband'),
('Dinner with Team', 78.40, 'expense', 'Food', CURRENT_DATE - INTERVAL 2 DAY, 'Weekend dinner celebration'),
('Fuel Station', 45.00, 'expense', 'Transport', CURRENT_DATE - INTERVAL 1 DAY, 'Weekly commute fuel refill');
