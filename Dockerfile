# Use PHP 8.2 with Apache
FROM php:8.2-apache

# Install SQLite3 and other useful packages
RUN apt-get update && apt-get install -y \
    libsqlite3-dev \
    && docker-php-ext-install pdo pdo_sqlite

# Enable Apache modules
RUN a2enmod rewrite

# Set PHP configuration
RUN echo "error_reporting = E_ALL" > /usr/local/etc/php/conf.d/error-reporting.ini

# Copy application files
COPY . /var/www/html/

# Set permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

# Set working directory
WORKDIR /var/www/html/

# Expose port 80
EXPOSE 80
