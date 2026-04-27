<script setup lang="ts">
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import App from './App.vue';

describe('App.vue', () => {
  it('renders successfully', () => {
    const wrapper = mount(App);
    expect(wrapper.exists()).toBe(true);
  });

  it('has a root element', () => {
    const wrapper = mount(App);
    expect(wrapper.element.tagName).toBe('DIV');
  });
});
</script>
