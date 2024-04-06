from django.urls import path, include

from dub import views

urlpatterns = [
    path('dub/video/', views.VideoDubView.as_view(), name='dub_video'),
    path('notes/video/', views.GenerateShortNotesView.as_view(), name='generate_notes'),
]