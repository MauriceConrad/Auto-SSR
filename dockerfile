FROM node:16-buster-slim
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
    ffmpeg \
    wget
ARG NPM_TOKEN
RUN wget "https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf" --directory-prefix /usr/share/fonts/
# COPY .npmrc .npmrc
COPY package.json .
COPY package-lock.json .
RUN npm ci
RUN chmod -R o+rwx node_modules/puppeteer/.local-chromium
# RUN rm -f .npmrc
COPY . /app
CMD ["node", "dist"]
