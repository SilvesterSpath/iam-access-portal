<script setup lang="ts">
import { ref } from 'vue';
import AuditLog from './components/AuditLog.vue';
import UserManagement from './components/UserManagement.vue';

const reloadToken = ref(0);

function onChanged() {
  reloadToken.value += 1;
}
</script>

<template>
  <main class="page">
    <header class="page-header">
      <h1>Access Provisioning & Audit Portal</h1>
      <p>Manage user roles and review access-change history.</p>
    </header>

    <UserManagement @changed="onChanged" />
    <AuditLog :reload-token="reloadToken" />
  </main>
</template>
