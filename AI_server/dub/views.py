import dub.Scripts.shared_imports as shared_imports
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from dub.video_dubber import dub_for_all_lang
import subprocess as sp
import os
import dub.Scripts.transcribe as transcribe
import configparser
import langcodes
import dubbing.settings as settings
from dub.Scripts.transcribe import download_file_from_s3
from dub.Scripts.vdocipher_uploader import upload_video_to_vdocipher
from bson.objectid import ObjectId


from dubbing.settings import mongoDB


class VideoDubView(APIView):

    def post(self, request):
        data = request.data
        courseId = data.get('courseId')

        print(f"INTIATING DUBBING PROCESS FOR COURSE ID : {courseId}\n\n")
        # print(mongoDB.list_collection_names())
        courses = mongoDB['courses']
        course = courses.find_one({ '_id' : ObjectId(courseId)  })
        courseData = course['courseData']

        try:
            batchConfig = configparser.ConfigParser()
            batchConfig.read('dub/batch.ini')
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error reading batch.ini: {e}'
                }, status=status.HTTP_400_BAD_REQUEST)



        if not os.path.exists(shared_imports.DOWNLOAD_DIRECTORY):
            os.makedirs(shared_imports.DOWNLOAD_DIRECTORY)

        LANGUAGE = []
        languageNums = batchConfig['SETTINGS']['enabled_languages'].replace(' ','').split(',')

        for num in languageNums:
            lang_code = batchConfig[f'LANGUAGE-{num}']['synth_language_code']
            lang = langcodes.get(lang_code)
            langName = langcodes.get(lang_code).get(lang.to_alpha3()).display_name()
            LANGUAGE.append(langName)

        # print(LANGUAGE)

        """
        FOR EXAMPLE
        data = {
            'title': 'test_video1', 'videoSection': 'Section 1', 'description': 'test_video_description', 'videoLength': 1,
            'links': [{'title': 'ksadjlf', 'url': 'akdfjakls', '_id': ObjectId('660fb1464cdace42a256d401')}],
            'suggestion': '', '_id': ObjectId('660fb1464cdace42a256d400'),
            'questions': [{'user': {'_id': '660fad714cdace42a256d3a1', 'name': 'prakash', 'email': 'prakash02dec@gmail.com', 'role': 'admin', 'isVerified': False, 'courses': [{'_id': '660fb1464cdace42a256d3fd'}], 'createdAt': '2024-04-05T07:51:13.198Z', 'updatedAt': '2024-04-05T07:51:13.198Z', '__v': 0},
            'question': 'awesome\n', 'questionReplies': [{'user': {'_id': '660fad714cdace42a256d3a1', 'name': 'prakash', 'email': 'prakash02dec@gmail.com', 'role': 'admin', 'isVerified': False, 'courses': [{'_id': '660fb1464cdace42a256d3fd'}], 'createdAt': '2024-04-05T07:51:13.198Z', 'updatedAt': '2024-04-05T07:51:13.198Z', '__v': 0},
            'answer': 'kesa hai yrr', 'createdAt': '2024-04-05T08:13:15.202Z', 'updatedAt': '2024-04-05T08:13:15.202Z'}], '_id': ObjectId('660fb28a4cdace42a256d4b1'), 'createdAt': datetime.datetime(2024, 4, 5, 8, 12, 58, 483000), 'updatedAt': datetime.datetime(2024, 4, 5, 8, 13, 15, 204000)}],
            's3Url': 's3://globallearn/sample_video.mp4', 'videoUrls': [{'language': 'english', 'url': 'bcd85ca1c4e08051dcd07ed203241312', '_id': ObjectId('660fb68e14440ec7f48c8c11')}]
        }
        """

        for content in courseData:
            # first get aws url from course data
            # and by default its english
            # now we need to download the video from aws
            # now transcribe the video
            # NOW FOR EACH LANGUAGE dub the video
            # and upload to video chiper
            # and now append the video url  array with the new url with its respective language
            # save in mongodb

            s3Url = content['s3Url']
            video = s3Url.split('/')[3]
            video_name = video.split('.')[0]

            print(f"Downloading video from aws s3 : {video}")

            shared_imports.DOWNLOAD_FOLDER = os.path.join(shared_imports.DOWNLOAD_DIRECTORY , video_name)

            if not os.path.exists(shared_imports.DOWNLOAD_FOLDER):
                os.makedirs(shared_imports.DOWNLOAD_FOLDER)

            VIDEO_URL = os.path.join(shared_imports.DOWNLOAD_FOLDER , video)
            SRT_URL = os.path.join(shared_imports.DOWNLOAD_FOLDER , f'{video_name}.srt')

            try :
                download_file_from_s3(s3Url, VIDEO_URL, settings.AWS_SESSION )
            except Exception as e:
                return Response({
                    'success': False,
                    'message': f'Error downloading video from s3: {e}'
                    }, status=status.HTTP_400_BAD_REQUEST)

            try:
                batchConfig.set('SETTINGS', 'original_video_file_path', VIDEO_URL)
                batchConfig.set('SETTINGS', 'srt_file_path', SRT_URL)

                with open('dub/batch.ini', 'w') as configfile:
                    batchConfig.write(configfile)

                shared_imports.set_up_config()

            except configparser.Error as e:
                print(f"Error updating configuration file: {e}")
            except IOError as e:
                print(f"IOError: {e}")



            output_audio_file_path = os.path.join(shared_imports.DOWNLOAD_FOLDER , f'{video_name}.mp3')
            audioCommand = f'ffmpeg -y -i {VIDEO_URL} -vn -acodec libmp3lame -q:a 0 {output_audio_file_path}'
            print(output_audio_file_path)
            print(audioCommand)
            print("\n Extracting Original audio track from the video...")
            sp.run(audioCommand)

            transcribe.transcribe(output_audio_file_path,VIDEO_URL)

            dub_videos_file_path = dub_for_all_lang(VIDEO_URL, SRT_URL)

            # now upload the video to vdocipher and get the video id
            for language , file_path in dub_videos_file_path:
                print(f"Uploading video to vdocipher for language : {language}")
                videoId = upload_video_to_vdocipher(f'{video_name} - {language}', file_path)['videoId']

                # Create a new dictionary
                ispresent = False

                for video_url in content['videoUrls']:
                    if video_url['language'] == language:
                        video_url['url'] = videoId
                        ispresent = True
                        break

                if not ispresent:
                    new_video_url = {
                        'language': language,
                        'url': videoId,
                        '_id': ObjectId()  # This will generate a new ObjectId for each video URL
                    }
                    # now append the new video url  array with the new url with its respective language
                    content['videoUrls'].append(new_video_url)

            # save in mongodb
            courses.update_one(
                { '_id' : ObjectId(courseId) },
                { '$set': { 'courseData': courseData } }
            )

        return Response({
            'success': True,
            'message': 'dubbing done'
            }, status=status.HTTP_200_OK)

