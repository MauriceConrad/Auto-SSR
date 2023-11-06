FROM node:18-buster-slim
WORKDIR /app
RUN apt-get update
RUN apt-get install -y \
    fonts-liberation \
    gconf-service \
    libappindicator1 \
    libasound2 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libfontconfig1 \
    libgbm-dev \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libicu-dev \
    libjpeg-dev \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libpng-dev \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    libosmesa6-dev
COPY . /app
COPY package.json .
COPY package-lock.json .
RUN npm ci
RUN npm run build
# RUN rm -f .npmrc
RUN chmod -R o+rwx node_modules/puppeteer/.local-chromium
#RUN ln -s /usr/lib/x86_64-linux-gnu/libOSMesa.so.6 /opt/google/chrome/libosmesa.so
#RUN node_modules/puppeteer/.local-chromium --no-first-run --user-data-dir=~/chrome-stuff --use-gl=osmesa
CMD ["node", "dist"]
