import os
from openai import OpenAI
import dubbing.settings as settings

client = OpenAI(
    # This is the default and can be omitted
    api_key= settings.OPENAI_API_KEY,
)


def generate_short_notes(transcribed_text):
    prompt = f"Generate short notes from the following transcript:\n\n{transcribed_text}\n\nNotes:"
    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
        model="gpt-3.5-turbo",
    )
    return chat_completion.choices[0].message.content

# # Example usage
# transcribed_text = """
# [{"transcript":"Everybody talks about becoming a better person. But I feel like everyone is skipping step one and step one is to see yourself exactly as you are with no change and with no judgment, no matter how seemingly ugly years ago when I was an Alcoholics anonymous, we used to introduce ourselves by saying our name and then saying that we're an alcoholic. My name is Ian and I'm an alcoholic. It's a radical acceptance of oneself. My name is Ian and I struggle with self judgment and self criticism. I'm 30 years old. I still get pimples. I have crooked teeth in the past. I've struggled immensely with porn addiction and substance abuse in my romantic life. I have severe anxiety and trauma. I've never been in a long term relationship. I've learned that if you struggle with self love, the answer isn't to try to love yourself harder love isn't a matter of effort. It's a matter of awareness. It's a matter of letting go of all trying."}]
# """
# short_notes = generate_short_notes(transcribed_text)
# print(short_notes)
