<script setup>
import { useProjectStore } from '../stores/project'
const projStore = useProjectStore();
</script>
<template>
    <div class="flex">
        <div v-for="proj in projStore.list" @click="$router.push({ path: '/editor', query: { id: proj.id } })" class="mx-2">
            <span class="p-4 rounded border-[1px] cursor-pointer"> {{ proj.id }} {{ proj.name }} </span>
        </div>
    </div>
</template>