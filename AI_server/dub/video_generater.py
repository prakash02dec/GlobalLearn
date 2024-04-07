import os
import sys

sys.path.insert(1, os.getcwd())

import subprocess as sp
import pathlib
import shutil
from pydub import AudioSegment
import langcodes
import dub.Scripts.shared_imports as shared_imports
shared_imports.set_up_config()

import os
import sys
import traceback
import configparser
import re
import regex

def video_generater():

    videoToProcess = shared_imports.ORIGINAL_VIDEO_PATH
    tracksFolder = shared_imports.OUTPUT_FOLDER
    defaultLanguage = "English"

    tracksToAddDict = {}

    for file in os.listdir(tracksFolder):
        if (file.endswith(".mp3") or file.endswith(".aac") or file.endswith(".wav")) :
            nameNoExt = os.path.splitext(file)[0]

            if ' - ' in nameNoExt:
                parsedLanguageCode = nameNoExt.split(' - ')[-1].strip()
            else:
                # Print error and ask whether to continue
                print(f"\nWARNING: Could not find language code in filename: {file}")
                print("\nTo read the language code, separate the language code from the rest of the filename with: ")
                print("     ' - ' (a dash surrounded by spaces)")
                print("For example:   'Whatever Video - en-us.wav'")
                print("Enter 'y' to skip that track and conitnue, or enter anything else to exit.")

                userInput = input("Continue Anyway? (y/n): ")
                if userInput.lower() != 'y':
                    sys.exit()

            # Check if the language code is valid
            try:
                langObject = langcodes.get(parsedLanguageCode)
                threeLetterCode = langObject.to_alpha3()
                languageDisplayName = langcodes.get(threeLetterCode).display_name()

                if threeLetterCode in tracksToAddDict.keys():
                    print(f"\ERROR while checking {file}: Language '{languageDisplayName}' is already in use by file: {tracksToAddDict[threeLetterCode]}")
                    userInput = input("\nPress Enter to exit... ")
                    sys.exit()

                tracksToAddDict[threeLetterCode] = file

            except:
                print(f"\nWARNING: Language code '{parsedLanguageCode}' is not valid for file: {file}")
                print("Enter 'y' to skip that track and conitnue, or enter anything else to exit.")
                userInput = input("\nContinue Anyway and Skip File? (y/n): ")
                if userInput.lower() != 'y':
                    sys.exit()

    print("")


    # Convert each entry in tracksToAddDict to an absolute path and combine with tracksFolder
    tracksFolder = os.path.normpath(tracksFolder)
    print(tracksFolder)
    videoToProcess = os.path.join(tracksFolder, videoToProcess)
    tempdir = os.path.join(tracksFolder, "temp")
    # Get number of tracks to add
    numTracks = len(tracksToAddDict)
    tempFilesToDelete = []


    def convert_to_stereo(tracksDict):
        for langcode, fileName in tracksDict.items():
            filePath = os.path.join(tracksFolder, fileName)

            audio = AudioSegment.from_file(filePath)

            num_channels = audio.channels
            if num_channels == 1:

                if not os.path.exists(tempdir):
                    os.makedirs(tempdir)

                fileExtension = os.path.splitext(filePath)[1][1:]

                stereo_file = audio.set_channels(2)

                tempFilePath = f"{os.path.join(tempdir, fileName)}_stereo_temp.{fileExtension}" # Change this before publishing, needs to adapt to filetype

                if fileExtension == "aac":
                    formatString = "adts"
                else:
                    formatString = fileExtension

                # Export the file with appropriate format
                stereo_file.export(tempFilePath, format=formatString, bitrate="128k") # Change this before publishing, needs to adapt to filetype
                tracksDict[langcode] = tempFilePath

                tempFilesToDelete.append(tempFilePath)

            else:
                # File is already stereo, so just use the original file
                tracksDict[langcode] = filePath
        return tracksDict



    print("\nChecking if tracks are stereo...")
    tracksToAddDict = convert_to_stereo(tracksToAddDict)


    ################################################################ All Together ####################################################################################

    # outputFile = f"{pathlib.Path(videoToProcess).stem} - MultiTrack.mp4"
    # outputFile = os.path.join(tracksFolder, outputFile)

    # # Create string for ffmpeg command for each string
    # #Example:    sp.run(f'ffmpeg -i "video.mp4" -i "audioTrack.mp3" -map 0 -map 1 -metadata:s:a:0 language=eng -metadata:s:a:1 language=spa -codec copy output.mp4')
    # # In metadata, a=audio, s=stream, 0=first stream, 1=second stream, etc  -  Also: g=global container, c=chapter, p=program
    # trackStringsCombined = ""
    # mapList = "-map 0"
    # metadataCombined = f'-metadata:s:a:0 language={defaultLanguage} -metadata:s:a:0 title="{defaultLanguage}" -metadata:s:a:0 handler_name="{defaultLanguage}"'
    # count = 1
    # for langcode, filePath in tracksToAddDict.items():
    #     languageDisplayName = langcodes.get(langcode).display_name()
    #     trackStringsCombined += f' -i "{filePath}"'
    #     metadataCombined += f' -metadata:s:a:{count} language={langcode}'
    #     metadataCombined += f' -metadata:s:a:{count} handler_name={languageDisplayName}' # Handler shows as the track title in MPC-HC
    #     metadataCombined += f' -metadata:s:a:{count} title="{languageDisplayName}"' # This is the title that will show up in the audio track selection menu
    #     mapList += f' -map {count}'
    #     count+=1

    # finalCommand = f'ffmpeg -y -i "{videoToProcess}" {trackStringsCombined} {mapList} {metadataCombined} -codec copy "{outputFile}"'

    # print("\n Adding audio tracks to video...")
    # sp.run(finalCommand)

    ####################################################################################################################################################


    # Create string for ffmpeg command for each string
    #Example:    sp.run(f'ffmpeg -i "video.mp4" -i "audioTrack.mp3" -map 0 -metadata:s:a:0 language=eng -codec copy output.mp4')
    # In metadata, a=audio, s=stream, 0=first stream, 1=second stream, etc  -  Also: g=global container, c=chapter, p=program

    # [[language, filepath], [language, filePath], ...]
    outputFilesPath = []

    trackStringsCombined = ""
    metadata = f'-metadata:s:a:0 language={defaultLanguage} -metadata:s:a:0 title="{defaultLanguage}" -metadata:s:a:0 handler_name="{defaultLanguage}"'

    outputFile = f"{pathlib.Path(videoToProcess).stem} - {defaultLanguage}.mp4"
    outputFile = os.path.join(tracksFolder, outputFile)
    finalCommand = f'ffmpeg -y -i "{videoToProcess}" {trackStringsCombined} -map 0 {metadata} -codec copy "{outputFile}"'


    # print(finalCommand)

    # as default language is already uploaded from the frontend so we dont need to run
    # sp.run(finalCommand)

    for langcode, filePath in tracksToAddDict.items():

        languageDisplayName = langcodes.get(langcode).display_name()

        outputFile = f"{pathlib.Path(videoToProcess).stem} - {languageDisplayName}.mp4"
        outputFile = os.path.join(tracksFolder, outputFile)

        trackStringsCombined = f' -i "{filePath}"'
        metadata = f'-metadata:s:a:0 language={langcode} -metadata:s:a:0 title="{languageDisplayName}" -metadata:s:a:0 handler_name="{languageDisplayName}"'

        finalCommand = f'ffmpeg -y -i "{videoToProcess}" {trackStringsCombined} -map 0:v -map 1:a {metadata} -c:v copy  -c:a aac "{outputFile}"'
        # print(finalCommand)
        sp.run(finalCommand)
        outputFilesPath.append([languageDisplayName , outputFile])


    # Delete temp files
    print("\nDeleting temporary files...")
    for file in tempFilesToDelete:
        os.remove(file)
    # Delete temp directory
    try:
        if os.path.exists(tempdir):
            os.rmdir(tempdir)
    except OSError as e:
        print("\nCould not delete temp directory. It may not be empty.")

    print("")
    print( shared_imports.ORIGINAL_VIDEO_NAME , " Videos generation completed.")

    return outputFilesPath
