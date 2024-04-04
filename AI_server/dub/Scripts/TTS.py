import json
import base64
import os
import time
import configparser
from googleapiclient.errors import HttpError
import datetime
import zipfile
import io
import copy
import re
from urllib.request import urlopen
import aiohttp
import asyncio

from dub.Scripts.shared_imports import *
import dub.Scripts.auth as auth
import dub.Scripts.utils as utils

# Get variables from config


ELEVENLABS_API_KEY = cloudConfig['elevenlabs_api_key']

# Get List of Voices Available
def get_voices():
    voices = auth.GOOGLE_TTS_API.voices().list().execute()
    voices_json = json.dumps(voices)
    return voices_json



interpretAsOverrideFile = os.path.join('./dub/SSML_Customization', 'interpret-as.csv')
interpretAsEntries = utils.csv_to_dict(interpretAsOverrideFile)

aliasOverrideFile = os.path.join('./dub/SSML_Customization', 'aliases.csv')
aliasEntries = utils.csv_to_dict(aliasOverrideFile)

urlListFile = os.path.join('./dub/SSML_Customization', 'url_list.txt')
urlList = utils.txt_to_list(urlListFile)

phonemeFile = os.path.join('./dub/SSML_Customization', 'Phoneme_Pronunciation.csv')
phonemeEntries = utils.csv_to_dict(phonemeFile)

def add_all_pronunciation_overrides(text):
    text = add_interpretas_tags(text)
    text = add_alias_tags(text)
    text = add_phoneme_tags(text)
    return text

def add_interpretas_tags(text):
    # Add interpret-as tags from interpret-as.csv
    for entryDict in interpretAsEntries:
        # Get entry info
        entryText = entryDict['Text']
        entryInterpretAsType = entryDict['interpret-as Type']
        isCaseSensitive = parseBool(entryDict['Case Sensitive (True/False)'])
        entryFormat = entryDict['Format (Optional)']

        # Create say-as tag
        if entryFormat == "":
            sayAsTagStart = rf'<say-as interpret-as="{entryInterpretAsType}">'
        else:
            sayAsTagStart = rf'<say-as interpret-as="{entryInterpretAsType}" format="{entryFormat}">'

        # Find and replace the word
        findWordRegex = rf'(\b["\']?{entryText}[.,!?]?["\']?\b)' # Find the word, with optional punctuation after, and optional quotes before or after
        if isCaseSensitive:
            text = re.sub(findWordRegex, rf'{sayAsTagStart}\1</say-as>', text) # Uses group reference, so remember regex must be in parentheses

        else:
            text = re.sub(findWordRegex, rf'{sayAsTagStart}\1</say-as>', text, flags=re.IGNORECASE)

    # Add interpret-as tags from url_list.txt
    for url in urlList:
        # This regex expression will match the top level domain extension, and the punctuation before/after it, and any periods, slashes or colons
        # It will then put the say-as characters tag around all matches
        punctuationRegex = re.compile(r'((?:\.[a-z]{2,6}(?:\/|$|\s))|(?:[\.\/:]+))')
        taggedURL = re.sub(punctuationRegex, r'<say-as interpret-as="characters">\1</say-as>', url)
        # Replace any instances of the URL with the tagged version
        text = text.replace(url, taggedURL)

    return text

def add_alias_tags(text):
    for entryDict in aliasEntries:
        # Get entry info
        entryText = entryDict['Original Text']
        entryAlias = entryDict['Alias']
        if entryDict['Case Sensitive (True/False)'] == "":
            isCaseSensitive = False
        else:
            isCaseSensitive = parseBool(entryDict['Case Sensitive (True/False)'])

        # Find and replace the word
        findWordRegex = rf'\b["\'()]?{entryText}[.,!?()]?["\']?\b' # Find the word, with optional punctuation after, and optional quotes before or after
        if isCaseSensitive:
            text = re.sub(findWordRegex, rf'{entryAlias}', text)
        else:
            text = re.sub(findWordRegex, rf'{entryAlias}', text, flags=re.IGNORECASE)
    return text


# Uses the phoneme pronunciation file to add phoneme tags to the text
def add_phoneme_tags(text):
    for entryDict in phonemeEntries:
        # Get entry info
        entryText = entryDict['Text']
        entryPhoneme = entryDict['Phonetic Pronunciation']
        entryAlphabet = entryDict['Phonetic Alphabet']

        if entryDict['Case Sensitive (True/False)'] == "":
            isCaseSensitive = False
        else:
            isCaseSensitive = parseBool(entryDict['Case Sensitive (True/False)'])

        # Find and replace the word
        findWordRegex = rf'(\b["\'()]?{entryText}[.,!?()]?["\']?\b)' # Find the word, with optional punctuation after, and optional quotes before or after
        if isCaseSensitive:
            text = re.sub(findWordRegex, rf'<phoneme alphabet="ipa" ph="{entryPhoneme}">\1</phoneme>', text)
        else:
            text = re.sub(findWordRegex, rf'<phoneme alphabet="{entryAlphabet}" ph="{entryPhoneme}">\1</phoneme>', text, flags=re.IGNORECASE)
    return text



# Build API request for google text to speech, then execute
def synthesize_text_google(text, speedFactor, voiceName, voiceGender, languageCode, audioEncoding=config['synth_audio_encoding'].upper()):

    # Keep speedFactor between 0.25 and 4.0
    if speedFactor < 0.25:
        speedFactor = 0.25
    elif speedFactor > 4.0:
        speedFactor = 4.0

    # API Info at https://texttospeech.googleapis.com/$discovery/rest?version=v1
    # Try, if error regarding quota, waits a minute and tries again
    def send_request(speedFactor):
        response = auth.GOOGLE_TTS_API.text().synthesize(
            body={
                'input':{
                    "text": text
                },
                'voice':{
                    "languageCode":languageCode, # en-US
                    "ssmlGender": voiceGender, # MALE
                    "name": voiceName # "en-US-Neural2-I"
                },
                'audioConfig':{
                    "audioEncoding": audioEncoding, # MP3
                    "speakingRate": speedFactor
                }
            }
        ).execute()
        return response

    # Use try except to catch quota errors, there is a limit of 100 requests per minute for neural2 voices
    try:
        response = send_request(speedFactor)
    except HttpError as hx:
        print("Error Message: " + str(hx))
        if "Resource has been exhausted" in str(hx):
            # Wait 65 seconds, then try again
            print("Waiting 65 seconds to try again")
            time.sleep(65)
            print("Trying again...")
            response = send_request()
        else:
            input("Press Enter to continue...")
    except Exception as ex:
        print("Error Message: " + str(ex))
        input("Press Enter to continue...")


    # The response's audioContent is base64. Must decode to selected audio format
    decoded_audio = base64.b64decode(response['audioContent'])
    return decoded_audio

async def synthesize_text_elevenlabs_async_http(text, voiceID, modelID, apiKey=ELEVENLABS_API_KEY):
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voiceID}"
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey
    }
    data = {
        "text": text,
        "model_id": modelID,
        # "voice_settings": {
        #     "stability": 0.5,
        #     "similarity_boost": 0.5
        # }
    }

    audio_bytes = b''  # Initialize an empty bytes object

    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=data, headers=headers) as response:
            if response.status == 200:
                while True:
                    chunk = await response.content.read(1024)
                    if not chunk:
                        break
                    audio_bytes += chunk
            else:
                try:
                    error_message = await response.text()
                    error_dict = json.loads(error_message)
                    print(f"\n\nERROR: ElevenLabs API returned code: {response.status}  -  {response.reason}")
                    print(f" - Returned Error Status: {error_dict['detail']['status']}")
                    print(f" - Returned Error Message: {error_dict['detail']['message']}")

                    # Handle specific errors:
                    if error_dict['detail']['status'] == "invalid_uid" or error_dict['detail']['status'] == "voice_not_found":
                        print("    > You may have forgotten to set the voice name in batch.ini to an Elevenlabs Voice ID. The above message should tell you what invalid voice is currently set.")
                        print("    > See this article for how to find a voice ID: https://help.elevenlabs.io/hc/en-us/articles/14599760033937-How-do-I-find-my-voices-ID-of-my-voices-via-the-website-and-through-the-API-")
                # These are for errors that don't have a 'detail' key
                except KeyError:
                    if response.status == 401:
                        print("  > ElevenLabs did not accept the API key or you are unauthorized to use that voice.")
                        print("  > Did you set the correct ElevenLabs API key in the cloud_service_settings.ini file?\n")
                    elif response.status == 400:
                        print("  > Did you set the correct ElevenLabs API key in the cloud_service_settings.ini file?\n")
                    elif response.status == 429:
                        print("  > You may have exceeded the ElevenLabs API rate limit. Did you set the 'elevenlabs_max_concurrent' setting too high for your plan?\n")
                except Exception as ex:
                    print(f"ElevenLabs API error occurred.\n")
                return None

    return audio_bytes


def format_percentage_change(speedFactor):
    # Determine speedFactor value for  TTS. It should be either 'default' or a relative change.
    if speedFactor == 1.0:
        rate = 'default'
    else:
        # Whether to add a plus sign to the number to relative change. A negative will automatically be added
        if speedFactor >= 1.0:
            percentSign = '+'
        else:
            percentSign = ''
        # Convert speedFactor float value to a relative percentage
        rate = percentSign + str(round((speedFactor - 1.0) * 100, 5)) + '%'
    return rate



async def synthesize_dictionary_async(subsDict, langDict, skipSynthesize=False, max_concurrent_jobs=2, secondPass=False):
    semaphore = asyncio.Semaphore(max_concurrent_jobs)
    lock = asyncio.Lock()
    progress = 0
    total_tasks = len(subsDict)
    errorsOccured = False

    print("Beginning Text-To-Speech Audio Synthesis...")

    async def synthesize_and_save(key, value):
        nonlocal progress

        # Use this to set max concurrent jobs
        async with semaphore:
            audio = await synthesize_text_elevenlabs_async_http(
                value['translated_text'],
                langDict['voiceName'],
                langDict['voiceModel']
            )

            if audio:
                filePath = os.path.join('workingFolder', f'{str(key)}.mp3')
                with open(filePath, "wb") as out:
                    out.write(audio)
                subsDict[key]['TTS_FilePath'] = filePath
            else:
                nonlocal errorsOccured
                errorsOccured = True
                subsDict[key]['TTS_FilePath'] = "Failed"

        # Update and display progress after task completion
        async with lock:
            progress += 1
            print(f" TTS Progress: {progress} of {total_tasks}", end="\r")

    tasks = []

    for key, value in subsDict.items():
        if not skipSynthesize and cloudConfig['tts_service'] == "elevenlabs":
            task = asyncio.create_task(synthesize_and_save(key, value))
            tasks.append(task)

    # Wait for all tasks to complete
    await asyncio.gather(*tasks)

    print("                                        ") # Clear the line

    # If errors occurred, tell user
    if errorsOccured:
        print("Warning: Errors occurred during TTS synthesis. Please check any error messages above for details.")
    else:
        print("Synthesis Finished")
    return subsDict


def synthesize_dictionary(subsDict, langDict, skipSynthesize=False, secondPass=False):
    for key, value in subsDict.items():
        # TTS each subtitle text, write to file, write filename into dictionary
        filePath = os.path.join('workingFolder', f'{str(key)}.mp3')
        filePathStem = os.path.join('workingFolder', f'{str(key)}')
        if not skipSynthesize:

            duration = value['duration_ms_buffered']

            if secondPass:
                # Get speed factor from subsDict
                speedFactor = subsDict[key]['speed_factor']
            else:
                speedFactor = float(1.0)

            # Prepare output location. If folder doesn't exist, create it
            if not os.path.exists(os.path.dirname(filePath)):
                try:
                    os.makedirs(os.path.dirname(filePath))
                except OSError:
                    print("Error creating directory")

            # If Google TTS, use Google API
            if cloudConfig['tts_service'] == "google":
                audio = synthesize_text_google(value['translated_text'], speedFactor, langDict['voiceName'], langDict['voiceGender'], langDict['languageCode'])
                with open(filePath, "wb") as out:
                    out.write(audio)

                if config['debug_mode'] and secondPass == True:
                    with open(filePathStem+"_pass2.mp3", "wb") as out:
                        out.write(audio)

        subsDict[key]['TTS_FilePath'] = filePath

        # Get key index
        keyIndex = list(subsDict.keys()).index(key)
        # Print progress and overwrite line next time
        if not secondPass:
            print(f" Synthesizing TTS Line: {keyIndex+1} of {len(subsDict)}", end="\r")
        else:
            print(f" Synthesizing TTS Line (2nd Pass): {keyIndex+1} of {len(subsDict)}", end="\r")
    print("                                               ") # Clear the line
    return subsDict
