# Use Ubuntu as base for full compiler support
FROM ubuntu:22.04

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js, Python, Java, and C/C++ compilers
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    python3-pip \
    default-jdk \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN node --version && \
    npm --version && \
    python3 --version && \
    pip3 --version && \
    java -version && \
    javac -version && \
    gcc --version && \
    g++ --version

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Copy application files
COPY . .

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Start server
CMD ["node", "server.js"]
