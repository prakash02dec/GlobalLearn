import dub.Scripts.shared_imports as shared_imports
shared_imports.set_up_config()
import dub.Scripts.TTS as TTS
import dub.Scripts.audio_builder as audio_builder

from dub.Scripts.shared_imports import set_up_config
import dub.Scripts.translate as translate
import dub.Scripts.transcribe as transcribe
import dub.video_generater as video_generater

import subprocess as sp
import re
import copy
import asyncio

import ffprobe
import os
import sys
import traceback
import configparser
import regex

languageNums = []
videoFilePath = ""
srtFile = ""
# Create a dictionary of the settings from each section
batchSettings = {}




def batch_file_processing():
    global languageNums, videoFilePath, srtFile, batchSettings

    languageNums = shared_imports.batchConfig['SETTINGS']['enabled_languages'].replace(' ','').split(',')

    srtFile = os.path.abspath(shared_imports.batchConfig['SETTINGS']['srt_file_path'].strip("\""))

    # Get original video file path, also allow you to debug using a subtitle file without having the original video file
    videoFilePath = shared_imports.batchConfig['SETTINGS']['original_video_file_path']

    # Validate the number of sections
    for num in languageNums:
        # Check if section exists
        if not shared_imports.batchConfig.has_section(f'LANGUAGE-{num}'):
            raise ValueError(f'Invalid language number in batch.ini: {num} - Make sure the section [LANGUAGE-{num}] exists')

    # Validate the settings in each batch section
    for num in languageNums:
        if not shared_imports.batchConfig.has_option(f'LANGUAGE-{num}', 'synth_language_code'):
            raise ValueError(f'Invalid configuration in batch.ini: {num} - Make sure the option "synth_language_code" exists under [LANGUAGE-{num}]')
        if not shared_imports.batchConfig.has_option(f'LANGUAGE-{num}', 'synth_voice_name'):
            raise ValueError(f'Invalid configuration in batch.ini: {num} - Make sure the option "synth_voice_name" exists under [LANGUAGE-{num}]')
        if not shared_imports.batchConfig.has_option(f'LANGUAGE-{num}', 'translation_target_language'):
            raise ValueError(f'Invalid configuration in batch.ini: {num} - Make sure the option "translation_target_language" exists under [LANGUAGE-{num}]')
        if not shared_imports.batchConfig.has_option(f'LANGUAGE-{num}', 'synth_voice_gender'):
            raise ValueError(f'Invalid configuration in batch.ini: {num} - Make sure the option "synth_voice_gender" exists under [LANGUAGE-{num}]')

    for num in languageNums:

        # Set voice model if applicable (different from voice name, only used by some services)
        if not shared_imports.batchConfig.has_option(f'LANGUAGE-{num}', 'model'):
            model = "default"
        else:
            model = shared_imports.batchConfig[f'LANGUAGE-{num}']['model']

        if shared_imports.cloudConfig['tts_service'] == 'elevenlabs':
            if model == "default":
                model = shared_imports.cloudConfig['elevenlabs_default_model']
        else:
            model = "default"

        # Set the dictionary values for each language
        batchSettings[num] = {
            'synth_language_code': shared_imports.batchConfig[f'LANGUAGE-{num}']['synth_language_code'],
            'synth_voice_name': shared_imports.batchConfig[f'LANGUAGE-{num}']['synth_voice_name'],
            'translation_target_language': shared_imports.batchConfig[f'LANGUAGE-{num}']['translation_target_language'],
            'synth_voice_gender': shared_imports.batchConfig[f'LANGUAGE-{num}']['synth_voice_gender'],
            'synth_voice_model': model,
        }



def parse_srt_file(srtFileLines, preTranslated=False):
    # Matches the following example with regex:    00:00:20,130 --> 00:00:23,419
    subtitleTimeLineRegex = re.compile(r'\d\d:\d\d:\d\d,\d\d\d --> \d\d:\d\d:\d\d,\d\d\d')

    # Create a dictionary
    subsDict = {}

    # Will add this many milliseconds of extra silence before and after each audio clip / spoken subtitle line
    addBufferMilliseconds = int(shared_imports.config['add_line_buffer_milliseconds'])

    for lineNum, line in enumerate(srtFileLines):
        line = line.strip()
        if line.isdigit() and subtitleTimeLineRegex.match(srtFileLines[lineNum + 1]):
            lineWithTimestamps = srtFileLines[lineNum + 1].strip()
            lineWithSubtitleText = srtFileLines[lineNum + 2].strip()

            # If there are more lines after the subtitle text, add them to the text
            count = 3
            while True:
                # Check if the next line is blank or not
                if (lineNum+count) < len(srtFileLines) and srtFileLines[lineNum + count].strip():
                    lineWithSubtitleText += ' ' + srtFileLines[lineNum + count].strip()
                    count += 1
                else:
                    break

            # Create empty dictionary with keys for start and end times and subtitle text
            subsDict[line] = {'start_ms': '', 'end_ms': '', 'duration_ms': '', 'text': '', 'break_until_next': '', 'srt_timestamps_line': lineWithTimestamps}

            time = lineWithTimestamps.split(' --> ')
            time1 = time[0].split(':')
            time2 = time[1].split(':')

            # Converts the time to milliseconds
            processedTime1 = int(time1[0]) * 3600000 + int(time1[1]) * 60000 + int(time1[2].split(',')[0]) * 1000 + int(time1[2].split(',')[1]) #/ 1000 #Uncomment to turn into seconds
            processedTime2 = int(time2[0]) * 3600000 + int(time2[1]) * 60000 + int(time2[2].split(',')[0]) * 1000 + int(time2[2].split(',')[1]) #/ 1000 #Uncomment to turn into seconds
            timeDifferenceMs = str(processedTime2 - processedTime1)

            # Adjust times with buffer
            if addBufferMilliseconds > 0 and not preTranslated:
                subsDict[line]['start_ms_buffered'] = str(processedTime1 + addBufferMilliseconds)
                subsDict[line]['end_ms_buffered'] = str(processedTime2 - addBufferMilliseconds)
                subsDict[line]['duration_ms_buffered'] = str((processedTime2 - addBufferMilliseconds) - (processedTime1 + addBufferMilliseconds))
            else:
                subsDict[line]['start_ms_buffered'] = str(processedTime1)
                subsDict[line]['end_ms_buffered'] = str(processedTime2)
                subsDict[line]['duration_ms_buffered'] = str(processedTime2 - processedTime1)

            # Set the keys in the dictionary to the values
            subsDict[line]['start_ms'] = str(processedTime1)
            subsDict[line]['end_ms'] = str(processedTime2)
            subsDict[line]['duration_ms'] = timeDifferenceMs
            subsDict[line]['text'] = lineWithSubtitleText
            if lineNum > 0:
                # Goes back to previous line's dictionary and writes difference in time to current line
                subsDict[str(int(line)-1)]['break_until_next'] = processedTime1 - int(subsDict[str(int(line) - 1)]['end_ms'])
            else:
                subsDict[line]['break_until_next'] = 0


    # Apply the buffer to the start and end times by setting copying over the buffer values to main values
    if addBufferMilliseconds > 0 and not preTranslated:
        for key, value in subsDict.items():
            subsDict[key]['start_ms'] = value['start_ms_buffered']
            subsDict[key]['end_ms'] = value['end_ms_buffered']
            subsDict[key]['duration_ms'] = value['duration_ms_buffered']

    return subsDict



def get_duration(filename):
    import subprocess, json
    result = subprocess.check_output(
            f'ffprobe -v quiet -show_streams -select_streams v:0 -of json "{filename}"', shell=True).decode()
    fields = json.loads(result)['streams'][0]
    try:
        duration = fields['tags']['DURATION']
    except KeyError:
        duration = fields['duration']
    durationMS = round(float(duration)*1000) # Convert to milliseconds
    return durationMS




def manually_prepare_dictionary(dictionaryToPrep):
    for key, value in dictionaryToPrep.items():
        dictionaryToPrep[key]['translated_text'] = value['text']

    return {int(k): v for k, v in dictionaryToPrep.items()}

def get_pretranslated_subs_dict(langData):
    # Get list of files in the output folder
    files = os.listdir(shared_imports.OUTPUT_FOLDER)

    # Check if any files ends with the specific language code and srt file extension
    for file in files:
        if file.replace(' ', '').endswith(f"-{langData['translation_target_language']}.srt"):
            # If so, open the file and read the lines into a list
            with open(f"{shared_imports.OUTPUT_FOLDER}/{file}", 'r', encoding='utf-8-sig') as f:
                pretranslatedSubLines = f.readlines()
            print(f"Pre-translated file found: {file}")

            # Parse the srt file using function
            preTranslatedDict = parse_srt_file(pretranslatedSubLines, preTranslated=True)

            # Convert the keys to integers
            preTranslatedDict = manually_prepare_dictionary(preTranslatedDict)

            # Return the dictionary
            return preTranslatedDict

    # If no file is found, return None
    return None


def process_language(langData, processedCount, totalLanguages, originalLanguageSubsDict, totalAudioLength):
    langDict = {
        'targetLanguage': langData['translation_target_language'],
        'voiceName': langData['synth_voice_name'],
        'languageCode': langData['synth_language_code'],
        'voiceGender': langData['synth_voice_gender'],
        'translateService': langData['translate_service'],
        'formality': langData['formality'],
        'voiceModel': langData['synth_voice_model'],
        }

    individualLanguageSubsDict = copy.deepcopy(originalLanguageSubsDict)

    # Print language being processed
    print(f"\n----- Beginning Processing of Language ({processedCount}/{totalLanguages}): {langDict['languageCode']} -----")

    # Check for special case where original language is the same as the target language
    if langDict['languageCode'].lower() == shared_imports.config['original_language'].lower():
        print("Original language is the same as the target language. Skipping translation.")
        # individualLanguageSubsDict = manually_prepare_dictionary(individualLanguageSubsDict)
        # Runs through translation function and skips translation process, but still combines subtitles and prints srt file for native language
        individualLanguageSubsDict = translate.translate_dictionary(individualLanguageSubsDict, langDict, skipTranslation=True, forceNativeSRTOutput=True)

    elif shared_imports.config['skip_translation'] == False:
        # Translate
        individualLanguageSubsDict = translate.translate_dictionary(individualLanguageSubsDict, langDict, skipTranslation= shared_imports.config['skip_translation'])
        if shared_imports.config['stop_after_translation']:
            print("Stopping at translation is enabled. Skipping TTS and building audio.")
            return

    elif shared_imports.config['skip_translation'] == True:
        print("Skip translation enabled. Checking for pre-translated subtitles...")
        # Check if pre-translated subtitles exist
        pretranslatedSubsDict = get_pretranslated_subs_dict(langData)
        if pretranslatedSubsDict != None:
            individualLanguageSubsDict = pretranslatedSubsDict
        else:
            print(f"\nPre-translated subtitles not found for language '{langDict['languageCode']}' in folder '{shared_imports.OUTPUT_FOLDER}'. Skipping.")
            print(f"Note: Ensure the subtitle filename for this language ends with: ' - {langData['translation_target_language']}.srt'\n")
            return

    # Synthesize
    if shared_imports.cloudConfig['tts_service'] == 'elevenlabs':
        individualLanguageSubsDict = asyncio.run(TTS.synthesize_dictionary_async(individualLanguageSubsDict, langDict, skipSynthesize= shared_imports.config['skip_synthesize'], max_concurrent_jobs=shared_imports.cloudConfig['elevenlabs_max_concurrent']))
    else:
        individualLanguageSubsDict = TTS.synthesize_dictionary(individualLanguageSubsDict, langDict, skipSynthesize= shared_imports.config['skip_synthesize'])

    # Build audio
    individualLanguageSubsDict = audio_builder.build_audio(individualLanguageSubsDict, langDict, totalAudioLength, shared_imports.config['two_pass_voice_synth'])



if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())



def dub_for_all_lang(video_url, srt_url):

    # Counter for number of languages processed

    global languageNums, videoFilePath, srtFile, batchSettings

    # Set up the configuration
    set_up_config()

    if not os.path.exists(shared_imports.OUTPUT_DIRECTORY):
        os.makedirs(shared_imports.OUTPUT_DIRECTORY)
    if not os.path.exists(shared_imports.OUTPUT_FOLDER):
        os.makedirs(shared_imports.OUTPUT_FOLDER)


    if not os.path.exists('workingFolder'):
        os.makedirs('workingFolder')


    # videoToProcess = ORIGINAL_VIDEO_PATH

    # output_audio_file = f'{os.path.splitext(os.path.basename(videoToProcess))[0]}.mp3'
    # audioCommand = f'ffmpeg -y -i {videoToProcess} -vn -acodec libmp3lame -q:a 0 {output_audio_file}'

    # print("\n Extracting audio track from the video...")
    # sp.run(audioCommand)

    # transcribe.transcribe(output_audio_file,videoToProcess)

    batch_file_processing()

    # Open an srt file and read the lines into a list
    print(srtFile)
    with open(srtFile, 'r', encoding='utf-8-sig') as f:
        originalSubLines = f.readlines()

    originalLanguageSubsDict = parse_srt_file(originalSubLines)

    # Get the total audio length of the video
    if shared_imports.config['debug_mode'] and shared_imports.ORIGINAL_VIDEO_PATH.lower() == "debug.test":
        totalAudioLength = int(originalLanguageSubsDict[str(len(originalLanguageSubsDict))]['end_ms'])
    else:
        totalAudioLength = get_duration(shared_imports.ORIGINAL_VIDEO_PATH)

    processedCount = 0
    totalLanguages = len(batchSettings)

    # Process all languages
    print(f"\n----- Beginning Processing of Languages -----")
    batchSettings = translate.set_translation_info(batchSettings)

    for langNum, langData in batchSettings.items():
        processedCount += 1
        # Process current fallback language
        try:
            process_language(langData, processedCount, totalLanguages , originalLanguageSubsDict, totalAudioLength)
        except Exception as e:
            print(f"Error processing language {langData['synth_language_code']}: {e}")
            continue

    print(shared_imports.ORIGINAL_VIDEO_NAME," : audio dubbing done successfully")
    print("starting video generation...")
    video_generater.video_generater()
    return
