**SettingRow** — label + description on the left, a control on the right; stack them for a Settings panel.

```jsx
<SettingRow label="Digital rain" description="Falling code behind the typing surface.">
  <Switch checked={rain} onChange={setRain} />
</SettingRow>
<SettingRow label="Difficulty" description="Passage length and complexity." divider={false}>
  <Select value={d} onChange={setD} options={opts} />
</SettingRow>
```
