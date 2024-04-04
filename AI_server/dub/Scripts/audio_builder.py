import soundfile
import pyrubberband
import configparser
import pathlib
import os
import io
import math
from platform import system as sysPlatform

from dub.Scripts.shared_imports import *
import dub.Scripts.TTS as TTS

from pydub import AudioSegment
from pydub.silence import detect_leading_silence
import langcodes
import numpy
import subprocess


workingFolder = "workingFolder"

if sysPlatform() == "Darwin":
    os.environ['PATH'] += os.pathsep + os.getcwd()


def trim_clip(inputSound):
    trim_leading_silence: AudioSegment = lambda x: x[detect_leading_silence(x) :]
    trim_trailing_silence: AudioSegment = lambda x: trim_leading_silence(x.reverse()).reverse()
    strip_silence: AudioSegment = lambda x: trim_trailing_silence(trim_leading_silence(x))
    strippedSound = strip_silence(inputSound)
    return strippedSound


def insert_audio(canvas, audioToOverlay, startTimeMs):
    canvasCopy = canvas
    canvasCopy = canvasCopy.overlay(audioToOverlay, position=int(startTimeMs))
    return canvasCopy


def create_canvas(canvasDuration, frame_rate=48000):
    canvas = AudioSegment.silent(duration=canvasDuration, frame_rate=frame_rate)
    return canvas

def get_speed_factor(subsDict, trimmedAudio, desiredDuration, num):
    virtualTempFile = AudioSegment.from_file(trimmedAudio, format="wav")
    rawDuration = virtualTempFile.duration_seconds
    trimmedAudio.seek(0) # This MUST be done to reset the file pointer to the start of the file, otherwise will get errors next time try to access the virtual files
    desiredDuration = float(desiredDuration)
    speedFactor = (rawDuration*1000) / desiredDuration
    subsDict[num]['speed_factor'] = speedFactor
    return subsDict

def stretch_with_rubberband(y, sampleRate, speedFactor):
    rubberband_streched_audio = pyrubberband.time_stretch(y, sampleRate, speedFactor, rbargs={'--fine': '--fine'}) # Need to add rbarges in weird way because it demands a dictionary of two values
    return rubberband_streched_audio

def stretch_with_ffmpeg(audioInput, speed_factor):
    min_speed_factor = 0.5
    max_speed_factor = 100.0
    filter_loop_count = 1


    if speed_factor < min_speed_factor:
        filter_loop_count = math.ceil(math.log(speed_factor) / math.log(min_speed_factor))
        speed_factor = speed_factor ** (1 / filter_loop_count)
        if speed_factor < 0.001:
            raise ValueError(f"ERROR: Speed factor is extremely low, and likely an error. It was: {speed_factor}")
    elif speed_factor > max_speed_factor:
        raise ValueError(f"ERROR: Speed factor cannot be over 100. It was {speed_factor}.")

    command = ['ffmpeg', '-i', 'pipe:0', '-filter:a', f'atempo={speed_factor}', '-f', 'wav', 'pipe:1']
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # Pass the audio data to ffmpeg and read the processed data
    out, err = process.communicate(input=audioInput.getvalue())

    # Check for errors
    if process.returncode != 0:
        raise Exception(f'ffmpeg error: {err.decode()}')

    return out # Returns bytes

def stretch_audio_clip(audioFileToStretch, speedFactor, num):
    virtualTempAudioFile = io.BytesIO()
    # Write the raw string to virtualtempaudiofile
    audioObj, sampleRate = soundfile.read(audioFileToStretch) # auddioObj is a numpy array

    # Stretch the audio using user specified method
    if config['local_audio_stretch_method'] == 'ffmpeg':
        stretched_audio = stretch_with_ffmpeg(audioFileToStretch, speedFactor)
        virtualTempAudioFile.write(stretched_audio)
        if config['debug_mode']:
            # For debugging, save the stretched audio file using soundfile
            debug_file_path = os.path.join(workingFolder, f'{num}_stretched_ffmpeg.wav')
            with open(debug_file_path, 'wb') as f:
                f.write(stretched_audio)
    elif config['local_audio_stretch_method'] == 'rubberband':
        stretched_audio = stretch_with_rubberband(audioObj, sampleRate, speedFactor)
        #soundfile.write(f'{workingFolder}\\temp_stretched.wav', streched_audio, sampleRate)
        soundfile.write(virtualTempAudioFile, stretched_audio, sampleRate, format='wav')
        if config['debug_mode']:
            soundfile.write(os.path.join(workingFolder, f'{num}_stretched.wav'), stretched_audio, sampleRate) # For debugging, saves the stretched audio files

    return AudioSegment.from_file(virtualTempAudioFile, format="wav")


def build_audio(subsDict, langDict, totalAudioLength, twoPassVoiceSynth=False):
    virtualTrimmedFileDict = {}

    for key, value in subsDict.items():
        filePathTrimmed = os.path.join(workingFolder,  str(key)) + "_trimmed.wav"
        subsDict[key]['TTS_FilePath_Trimmed'] = filePathTrimmed

        try:
            rawClip = AudioSegment.from_file(value['TTS_FilePath'], format="mp3")
        except KeyError:
            print("\nERROR: An expected file was not found. This is likely because the TTS service failed to synthesize the audio. Refer to any error messages above.")
            sys.exit()
        except FileNotFoundError:
            if value['TTS_FilePath'] == "Failed":
                print("\nProgram failed because some audio was not synthesized. Refer to any error messages above.")
            else:
                print("\nERROR: An expected file was not found. This is likely because the TTS service failed to synthesize the audio. Refer to any error messages above.")
            sys.exit()
        trimmedClip = trim_clip(rawClip)
        if config['debug_mode']:
            trimmedClip.export(filePathTrimmed, format="wav")

        # Create virtual file in dictionary with audio to be read later
        tempTrimmedFile = io.BytesIO()
        trimmedClip.export(tempTrimmedFile, format="wav")
        virtualTrimmedFileDict[key] = tempTrimmedFile
        keyIndex = list(subsDict.keys()).index(key)
        print(f" Trimmed Audio: {keyIndex+1} of {len(subsDict)}", end="\r")
    print("\n")

    for key, value in subsDict.items():
        #subsDict = get_speed_factor(subsDict, value['TTS_FilePath_Trimmed'], value['duration_ms'], num=key)
        subsDict = get_speed_factor(subsDict, virtualTrimmedFileDict[key], value['duration_ms'], num=key)
        keyIndex = list(subsDict.keys()).index(key)
        print(f" Calculated Speed Factor: {keyIndex+1} of {len(subsDict)}", end="\r")
    print("\n")

    # Decide if doing two pass voice synth
    servicesToUseTwoPass = ['google']
    if cloudConfig['tts_service'] not in servicesToUseTwoPass:
        twoPassVoiceSynth = False

    # If two pass voice synth is enabled, have API re-synthesize the clips at the new speed
    if twoPassVoiceSynth == True:
        subsDict = TTS.synthesize_dictionary(subsDict, langDict, skipSynthesize=config['skip_synthesize'], secondPass=True)

        for key, value in subsDict.items():
            # Trim the clip and re-write file
            rawClip = AudioSegment.from_file(value['TTS_FilePath'], format="mp3")
            trimmedClip = trim_clip(rawClip)
            if config['debug_mode']:
                # Remove '.wav' from the end of the file path
                secondPassTrimmedFile = value['TTS_FilePath_Trimmed'][:-4] + "_p2_trimmed.wav"
                trimmedClip.export(secondPassTrimmedFile, format="wav")
            trimmedClip.export(virtualTrimmedFileDict[key], format="wav")
            keyIndex = list(subsDict.keys()).index(key)
            print(f" Trimmed Audio (2nd Pass): {keyIndex+1} of {len(subsDict)}", end="\r")
        print("\n")

        if config['force_stretch_with_twopass'] == True:
            for key, value in subsDict.items():
                subsDict = get_speed_factor(subsDict, virtualTrimmedFileDict[key], value['duration_ms'], num=key)
                keyIndex = list(subsDict.keys()).index(key)
                print(f" Calculated Speed Factor (2nd Pass): {keyIndex+1} of {len(subsDict)}", end="\r")
            print("\n")

    canvas = create_canvas(totalAudioLength)

    for key, value in subsDict.items():
        if ((not twoPassVoiceSynth or config['force_stretch_with_twopass'] == True) ) or config['force_always_stretch'] == True:
            #stretchedClip = stretch_audio_clip(value['TTS_FilePath_Trimmed'], speedFactor=subsDict[key]['speed_factor'], num=key)
            stretchedClip = stretch_audio_clip(virtualTrimmedFileDict[key], speedFactor=subsDict[key]['speed_factor'], num=key)
        else:
            #stretchedClip = AudioSegment.from_file(value['TTS_FilePath_Trimmed'], format="wav")
            stretchedClip = AudioSegment.from_file(virtualTrimmedFileDict[key], format="wav")
            virtualTrimmedFileDict[key].seek(0) # Not 100% sure if this is necessary but it was in the other place it is used

        canvas = insert_audio(canvas, stretchedClip, value['start_ms'])

        currentClipExpectedDuration = int(value['duration_ms'])
        currentClipTrueDuration = stretchedClip.duration_seconds * 1000
        difference = str(round(currentClipTrueDuration - currentClipExpectedDuration))
        if key < len(subsDict) and (currentClipTrueDuration + int(value['start_ms']) > int(subsDict[key+1]['start_ms'])):
            print(f"WARNING: Audio clip {str(key)} for language {langDict['languageCode']} is {difference}ms longer than expected and may overlap the next clip. Inspect the audio file after completion.")
        elif key == len(subsDict) and (currentClipTrueDuration + int(value['start_ms']) > totalAudioLength):
            print(f"WARNING: Audio clip {str(key)} for language {langDict['languageCode']} is {difference}ms longer than expected and may cut off at the end of the file. Inspect the audio file after completion.")


        keyIndex = list(subsDict.keys()).index(key)
        print(f" Final Audio Processed: {keyIndex+1} of {len(subsDict)}", end="\r")
    print("\n")


    lang = langcodes.get(langDict['languageCode'])
    langName = langcodes.get(langDict['languageCode']).get(lang.to_alpha3()).display_name()
    if config['debug_mode'] and not os.path.isfile(ORIGINAL_VIDEO_PATH):
        outputFileName = "debug" + f" - {langName} - {langDict['languageCode']}."
    else:
        outputFileName = pathlib.Path(ORIGINAL_VIDEO_PATH).stem + f" - {langName} - {langDict['languageCode']}."
    # Set output path
    outputFileName = os.path.join(OUTPUT_FOLDER, outputFileName)

    outputFormat=config['output_format'].lower()
    if outputFormat == "mp3":
        outputFileName += "mp3"
        formatString = "mp3"
    elif outputFormat == "wav":
        outputFileName += "wav"
        formatString = "wav"
    elif outputFormat == "aac":
        outputFileName += "aac"
        formatString = "adts"

    canvas = canvas.set_channels(2) # Change from mono to stereo
    try:
        print("\nExporting audio file...")
        canvas.export(outputFileName, format=formatString, bitrate="192k")
    except:
        outputFileName = outputFileName + ".bak"
        canvas.export(outputFileName, format=formatString, bitrate="192k")
        print("\nThere was an issue exporting the audio, it might be a permission error. The file was saved as a backup with the extension .bak")
        print("Try removing the .bak extension then listen to the file to see if it worked.\n")
        input("Press Enter to exit...")

    return subsDict
