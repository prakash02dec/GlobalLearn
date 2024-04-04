from django.urls import path, include

from dub import views

urlpatterns = [
    path('video/', views.VideoDubView.as_view(), name='create'),
]