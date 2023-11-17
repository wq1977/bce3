<script setup>
import { useProjectStore } from '../stores/project'
const projStore = useProjectStore();
</script>
<template>
    <div>
        <div v-for="proj in projStore.list">
            {{ proj.name }}
        </div>
    </div>
</template>