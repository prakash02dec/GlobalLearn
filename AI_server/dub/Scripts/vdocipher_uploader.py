import json
import requests
from requests_toolbelt import MultipartEncoder
import dubbing.settings as settings



def upload_video_to_vdocipher(video_title, video_file_path):
  ############# STEP 1 ####################
  api_secret_key = settings.VDOCIPHER_API_SECRET

  querystring = {"title": video_title}

  url = "https://dev.vdocipher.com/api/videos"
  headers = {
  'Authorization': "Apisecret " + api_secret_key
  }

  response = requests.request("PUT", url, headers=headers, params=querystring)

  ############# STEP 2 ####################

  uploadInfo = response.json()
  print(uploadInfo)

  clientPayload = uploadInfo['clientPayload']
  videoId = uploadInfo['videoId']

  uploadLink = clientPayload['uploadLink']
  filename = video_file_path  # use file name here

  m = MultipartEncoder(fields=[
    ('x-amz-credential', clientPayload['x-amz-credential']),
    ('x-amz-algorithm', clientPayload['x-amz-algorithm']),
    ('x-amz-date', clientPayload['x-amz-date']),
    ('x-amz-signature', clientPayload['x-amz-signature']),
    ('key', clientPayload['key']),
    ('policy', clientPayload['policy']),
    ('success_action_status', '201'),
    ('success_action_redirect', ''),
    ('file', ('filename', open(filename, 'rb'), 'text/plain'))
    ])

  response = requests.post(
  uploadLink,
  data=m,
  headers={'Content-Type': m.content_type}
  )

  return { 'videoId': videoId, 'response': response }