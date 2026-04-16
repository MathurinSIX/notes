#!/bin/bash

# Check if the URL and acceptable response time are provided
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <URL> <ACCEPTABLE_RESPONSE_TIME_IN_SECONDS>"
    exit 1
fi

URL=$1
ACCEPTABLE_RESPONSE_TIME=$2

echo "Starting ping test on $URL with an acceptable response time of $ACCEPTABLE_RESPONSE_TIME seconds..."
echo "Press Ctrl+C to stop the test."

# Initialize counters
TOTAL_REQUESTS=0
SUCCESSFUL_REQUESTS=0
FAILED_REQUESTS=0
TOTAL_RESPONSE_TIME=0

# Function to perform a single ping test
perform_ping_test() {
    local response_time
    local http_code

    # Get both response time and HTTP status code
    read -r response_time http_code < <(
        curl -o /dev/null -s -w "%{time_total} %{http_code}\n" "$URL"
    )

    ((TOTAL_REQUESTS++))

    if [ "$http_code" = "200" ]; then
        if (( $(echo "$response_time <= $ACCEPTABLE_RESPONSE_TIME" | bc -l) )); then
            ((SUCCESSFUL_REQUESTS++))
            TOTAL_RESPONSE_TIME=$(echo "$TOTAL_RESPONSE_TIME + $response_time" | bc)
            echo "$(date '+%Y-%m-%d %H:%M:%S') - URL is up (200). Response time: $response_time seconds."
        else
            ((FAILED_REQUESTS++))
            echo "$(date '+%Y-%m-%d %H:%M:%S') - URL is up (200) but response time $response_time seconds exceeds the acceptable threshold."
        fi
    else
        ((FAILED_REQUESTS++))
        echo "$(date '+%Y-%m-%d %H:%M:%S') - URL is down or returned HTTP $http_code."
    fi
}

# Function to generate a summary
generate_summary() {
    echo ""
    echo "Ping Test Summary"
    echo "================"
    echo "URL: $URL"
    echo "Acceptable Response Time: $ACCEPTABLE_RESPONSE_TIME seconds"
    echo "Total Requests: $TOTAL_REQUESTS"
    echo "Successful Requests: $SUCCESSFUL_REQUESTS"
    echo "Failed Requests: $FAILED_REQUESTS"
    if [ $SUCCESSFUL_REQUESTS -gt 0 ]; then
        AVERAGE_RESPONSE_TIME=$(echo "scale=3; $TOTAL_RESPONSE_TIME / $SUCCESSFUL_REQUESTS" | bc)
        echo "Average Response Time: $AVERAGE_RESPONSE_TIME seconds"
    else
        echo "Average Response Time: N/A"
    fi
}

# Trap Ctrl+C to exit the script gracefully and generate a summary
trap generate_summary EXIT

# Main loop to run the ping test indefinitely
while true; do
    perform_ping_test
    sleep 1  # Wait for 1 second before the next ping test
done