apt install nginx php7.4-fpm

/etc/nginx/sites-available/default


server {

        listen 80;
        listen [::]:80;

        server_name #domain;

        root /var/www/html;
        index index.html;
       
        location / {
                try_files $uri $uri/ =404;
        }

        location ~ \.php$ {
                include snippets/fastcgi-php.conf;
                fastcgi_pass unix:/run/php/php7.4-fpm.sock;
        }
}




Credit : https://github.com/librespeed/speedtest
