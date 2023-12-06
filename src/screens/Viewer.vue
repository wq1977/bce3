<script setup>
import { useRoute } from 'vue-router'
import { useProjectStore } from '../stores/project';
const route = useRoute()
const store = useProjectStore()
const albumid = route.query.album
</script>
<template>
    <div class="border h-screen">
        <iframe :src="store.getAlbumViewUrl(albumid)" frameborder="0" class="w-full h-full"></iframe>
    </div>
</template>