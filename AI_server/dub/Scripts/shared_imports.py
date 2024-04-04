import os
import sys
import traceback
import configparser
import re
import regex

from dub.Scripts.utils import parseBool, parseConfigSetting

# Get Config Values
configRaw = configparser.ConfigParser()
configRaw.read('./dub/config.ini')

cloudConfigRaw = configparser.ConfigParser()
cloudConfigRaw.read('./dub/cloud_service_settings.ini')

batchConfig = configparser.ConfigParser()
batchConfig.read('./dub/batch.ini') # Don't process this one, need sections in tact for languages


config = {}
cloudConfig = {}

for section in configRaw.sections():
    for key in configRaw[section]:
        config[key] = parseConfigSetting(configRaw[section][key])

for section in cloudConfigRaw.sections():
    for key in cloudConfigRaw[section]:
        cloudConfig[key] = parseConfigSetting(cloudConfigRaw[section][key])


if config['skip_synthesize'] == True and cloudConfig['batch_tts_synthesize'] == True:
    raise ValueError(f'\nERROR: Cannot skip voice synthesis when batch mode is enabled. Please disable batch_tts_synthesize or set skip_synthesize to False.')
if cloudConfig['tts_service'] == "elevenlabs":
    if "yourkey" in cloudConfig['elevenlabs_api_key'].lower():
        raise ValueError(f"\n\nERROR: You chose ElevenLabs as your TTS service, but didnt set your ElevenLabs API Key in cloud_service_settings.ini")


ORIGINAL_VIDEO_PATH = batchConfig['SETTINGS']['original_video_file_path']
ORIGINAL_VIDEO_NAME = os.path.splitext(os.path.basename(ORIGINAL_VIDEO_PATH))[0]
OUTPUT_DIRECTORY = 'Outputs'

OUTPUT_FOLDER = os.path.join(OUTPUT_DIRECTORY , ORIGINAL_VIDEO_NAME)


# Fix original video path if debug mode
if config['debug_mode'] and (ORIGINAL_VIDEO_PATH == '' or ORIGINAL_VIDEO_PATH.lower() == 'none'):
    ORIGINAL_VIDEO_PATH = 'Debug.test'
else:
    ORIGINAL_VIDEO_PATH = os.path.abspath(ORIGINAL_VIDEO_PATH.strip("\""))

__all__ = ['os', 'sys', 'traceback', 'config', 'cloudConfig', 'batchConfig', 'ORIGINAL_VIDEO_PATH', 'ORIGINAL_VIDEO_NAME', 'OUTPUT_DIRECTORY', 'OUTPUT_FOLDER', 're', 'regex', 'parseBool']
