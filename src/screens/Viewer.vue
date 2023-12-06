<script setup>
import { useRoute } from 'vue-router'
import { useProjectStore } from '../stores/project';
import { Icon } from '@iconify/vue';
const route = useRoute()
const store = useProjectStore()
const albumid = route.query.album
const episodeid = route.query.episode
</script>
<template>
    <div class="border h-screen">
        <RouterLink :to="`/`">
            <Icon icon="tabler:arrow-back" class="text-green-600 absolute right-5 top-5" />
        </RouterLink>
        <iframe :src="store.getViewUrl(albumid, episodeid)" frameborder="0" class="w-full h-full"></iframe>
    </div>
</template>