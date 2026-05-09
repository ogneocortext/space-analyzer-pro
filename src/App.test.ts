import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import App from "./App.vue";

describe("App", () => {
  let wrapper: any;

  beforeEach(() => {
    const pinia = createPinia();
    wrapper = mount(App, {
      global: {
        plugins: [pinia],
      },
    });
  });

  it("should render app component", () => {
    expect(wrapper.exists()).toBe(true);
  });

  it("should have correct structure", () => {
    expect(wrapper.find("router-view").exists()).toBe(true);
  });
});
