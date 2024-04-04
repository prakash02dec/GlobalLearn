from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from dub.audio_dubber import dub_for_all_lang
from dub.video_generater import vedio_generater
import configparser

class VideoDubView(APIView):
    def post(self, request):

        data = request.data
        print(data)
        video_url = data.get('video_url')

        config = configparser.ConfigParser()
        config.read('dub/batch.ini')

        config.set('SETTINGS', 'original_video_file_path', video_url)

        srt_url = data.get('srt_url')
        config.set('SETTINGS', 'srt_file_path', srt_url)

        with open('dub/batch.ini', 'w') as configfile:
            config.write(configfile)


        # dub_for_all_lang(video_url, srt_url)
        vedio_generater()

        return Response({'message': 'dubbing done'}, status=status.HTTP_200_OK)

