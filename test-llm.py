import requests
import json

# The endpoint for the local LLaMA server's chat completions API
LLAMA_API_URL = "http://localhost:8000/v1/chat/completions"

# Hardcoded paragraph to be summarized
paragraph_to_summarize = """
The sun, a giant star at the center of our solar system, is essential for all life on Earth. 
Its energy reaches our planet in the form of sunlight, which plants use to perform photosynthesis, 
converting light energy into chemical energy to create their own food. This process forms the 
base of most food chains. The sun's gravitational pull also keeps our planet and all the other 
planets, asteroids, and comets in orbit, maintaining the structure of the solar system.
"""

# The prompt instructing the LLM to summarize the text into bullet points
prompt_content = f"""
Summarize the following paragraph into a bulleted list.

Paragraph:
{paragraph_to_summarize}

Summary:
"""

# The JSON payload for the API request
payload = {
    "model": "your_llm_model_name",  # Replace with the name of your specific model
    "messages": [
        {"role": "user", "content": prompt_content}
    ],
    "max_tokens": 150,  # Limits the response length
    "temperature": 0.7  # Controls the creativity/randomness of the response
}

try:
    # Send the POST request
    response = requests.post(
        LLAMA_API_URL, 
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    response.raise_for_status()  # Throws an HTTPError for bad responses (4xx or 5xx)

    # Parse the JSON response
    result = response.json()
    
    # Extract the content of the LLM's response
    llm_response_content = result['choices'][0]['message']['content']
    
    # Print the formatted output
    print("Original Paragraph:")
    print(paragraph_to_summarize)
    print("-" * 30)
    print("Bulleted Summary:")
    print(llm_response_content.strip()) # .strip() removes leading/trailing whitespace

except requests.exceptions.RequestException as e:
    print(f"An error occurred while communicating with the LLM server: {e}")
except (KeyError, IndexError) as e:
    print(f"Error parsing the LLM response: {e}")
    print("Response JSON:")
    print(json.dumps(result, indent=2))
