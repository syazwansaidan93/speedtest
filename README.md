# Simple Web Speedtest

This is a simplified client-side web speed test based on the LibreSpeed project. It allows users to measure their internet download, upload, ping, and jitter directly in their web browser.

**Original Project & Author:**
This project is derived from **LibreSpeed**, originally created by **Federico Dossena**.
You can find the original project on GitHub: <https://github.com/librespeed/speedtest/>

## Features

This simplified version focuses on core speed testing functionalities:

* **Download Speed Test:** Measures your download bandwidth.

* **Upload Speed Test:** Measures your upload bandwidth.

* **Ping Test:** Determines the latency to the server.

* **Jitter Measurement:** Calculates the variation in ping times.

* **Single Server Operation:** Configured for a single test server, simplifying setup.

* **Clean UI:** Minimal interface for a straightforward user experience.

## How to Run It

To run this web speed test, you need a web server (like Apache, Nginx, or PHP's built-in server) that can serve PHP files.

### Prerequisites

* A web server (e.g., Apache, Nginx, or a simple PHP development server).

* PHP installed on your server (for `garbage.php` and `empty.php`).

### File Structure

Ensure your files are arranged as follows in your web server's document root (or a subdirectory):

```
your-speedtest-folder/
├── index.html
├── speedtest.js
├── speedtest_worker.js
├── garbage.php
└── empty.php
```

### Setup Instructions

1.  **Place Files:** Copy all the files (`index.html`, `speedtest.js`, `speedtest_worker.js`, `garbage.php`, `empty.php`) into a directory on your web server.

2.  **Configure PHP Files:**

    * Ensure `garbage.php` and `empty.php` are accessible by your web server and PHP interpreter. These files are crucial for the download, upload, and ping tests.

    * **Important:** If your `garbage.php` or `empty.php` are in a `backend/` subdirectory (as in some original LibreSpeed setups), you'll need to adjust the `url_dl`, `url_ul`, and `url_ping` parameters in `speedtest_worker.js` accordingly. In the current simplified version, they are expected to be in the same directory as `index.html`.

### Server Configuration Examples

#### Nginx Configuration

Here's an example Nginx server block configuration. This assumes you have PHP-FPM installed and running (e.g., `php-fpm` or `php8.x-fpm`).

Create a new Nginx configuration file (e.g., `/etc/nginx/sites-available/speedtest.conf`) and symlink it to `/etc/nginx/sites-enabled/`:

```nginx
server {
    listen 80; # Or 443 for HTTPS
    listen [::]:80; # Or 443 for HTTPS
    server_name your_domain.com; # Replace with your domain or IP address
    root /path/to/your-speedtest-folder; # IMPORTANT: Set this to the actual path where you placed the files
    index index.html;

    # Increase client body size limit for uploads (e.g., 100MB)
    client_max_body_size 100M;

    location / {
        try_files $uri $uri/ =404;
    }

    # Pass PHP scripts to PHP-FPM
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        # With php-fpm (e.g. Debian/Ubuntu):
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock; # Adjust PHP version as needed
        # With php-fpm (e.g. CentOS/RHEL):
        # fastcgi_pass unix:/run/php-fpm/www.sock;
    }

    # Optional: Prevent access to .ht* files if they exist
    location ~ /\.ht {
        deny all;
    }
}
```

After creating or modifying the Nginx configuration, test the configuration and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

**Note on PHP Upload Limits:**
If you still encounter "Request Entity Too Large" errors after adjusting `client_max_body_size` in Nginx, you might also need to increase PHP's upload limits. Check your `php.ini` file for the following directives and adjust them as needed (e.g., to `100M` or higher):

```ini
upload_max_filesize = 100M
post_max_size = 100M
```

Remember to restart your PHP-FPM service after modifying `php.ini` (e.g., `sudo systemctl restart php8.1-fpm`).

### Starting the Test

1.  **Start your web server.**

2.  **Open your web browser** and navigate to the URL where you placed the files (e.g., `http://localhost/your-speedtest-folder/index.html` or `http://your-domain.com/speedtest/`).

3.  The speed test page will load, and you can click the "Start" button to begin the test.

## Core Files Explained

* **`index.html`**: The main HTML file that provides the user interface for the speed test. It includes the necessary JavaScript files and displays the test results.

* **`speedtest.js`**: The client-side JavaScript library that interacts with the web worker (`speedtest_worker.js`). It manages the test states, handles UI updates, and provides methods to start and abort the test.

* **`speedtest_worker.js`**: A Web Worker script that performs the actual speed test measurements (download, upload, ping, jitter) in the background, preventing the main browser thread from freezing. It communicates results back to `speedtest.js`.

* **`garbage.php`**: A PHP script used by the download test. It generates a stream of random data for the client to download, allowing for accurate download speed measurement.

* **`empty.php`**: A very lightweight PHP script used by the upload and ping tests. For ping, it simply responds quickly to measure latency. For upload, it acts as a data sink, allowing the client to send data without the server needing to store or process it, ensuring the upload speed is measured accurately.

Feel free to explore and modify the code to suit your specific needs!
