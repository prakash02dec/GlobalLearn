import dub.Scripts.shared_imports as shared_imports
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from dub.video_dubber import dub_for_all_lang
import subprocess as sp
import os
import dub.Scripts.transcribe as transcribe
import configparser


from dubbing.settings import mongoDB


class VideoDubView(APIView):

    def post(self, request):
        data = request.data
        video_url = data.get('video_url')

        config = configparser.ConfigParser()

        videoToProcess = video_url
        file_name = os.path.splitext(os.path.basename(videoToProcess))[0]

        srt_url = f'{file_name}.srt'
        print(f'srt_url: {srt_url}')

        try:
            config.read('dub/batch.ini')
            config.set('SETTINGS', 'original_video_file_path', video_url)
            config.set('SETTINGS', 'srt_file_path', srt_url)

            with open('dub/batch.ini', 'w') as configfile:
                config.write(configfile)

            shared_imports.set_up_config()

        except configparser.Error as e:
            print(f"Error updating configuration file: {e}")
        except IOError as e:
            print(f"IOError: {e}")


        output_audio_file = f'{os.path.splitext(os.path.basename(videoToProcess))[0]}.mp3'
        audioCommand = f'ffmpeg -y -i {videoToProcess} -vn -acodec libmp3lame -q:a 0 {output_audio_file}'

        print("\n Extracting Original audio track from the video...")
        sp.run(audioCommand)

        transcribe.transcribe(output_audio_file,videoToProcess)

        dub_for_all_lang(video_url, srt_url)


        print(mongoDB.list_collection_names())
        courses = mongoDB['Courses']

        return Response({'message': 'dubbing done'}, status=status.HTTP_200_OK)

