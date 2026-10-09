FROM node:20-alpine

# Set working directory inside container
WORKDIR /usr/src/app

# Copy dependency files first for layer caching
COPY package*.json ./

# Install dependencies (production & development)
RUN npm install

# Copy application source code
COPY . .

# Expose backend port
EXPOSE 5000

# Start backend server
CMD ["npm", "start"]
