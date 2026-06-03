FROM node:18-alpine AS builder

# Build-time vars baked into the bundle by Create-React-App.
# Override at build time:
#   docker build --build-arg REACT_APP_API_BASE_URL=https://api.example.com/api ...
ARG REACT_APP_API_BASE_URL=http://localhost:5000/api
ARG REACT_APP_RAZORPAY_KEY_ID
ARG REACT_APP_API_TIMEOUT_MS=15000
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL \
    REACT_APP_RAZORPAY_KEY_ID=$REACT_APP_RAZORPAY_KEY_ID \
    REACT_APP_API_TIMEOUT_MS=$REACT_APP_API_TIMEOUT_MS

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Production stage
FROM node:18-alpine

ENV PORT=3000

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/build ./build

EXPOSE 3000

# `serve` reads $PORT automatically when -l is omitted; we keep the flag so
# the value is explicit.
CMD ["sh", "-c", "serve -s build -l ${PORT}"]
