# Alert text in your own language

The card's UI chrome — buttons, labels, badges, time expressions — follows your Home
Assistant locale automatically. The **alert text itself** does not. Titles, headlines,
descriptions and instructions are passed through from your provider exactly as issued,
and the card never rewrites them.

That is deliberate. These are life-safety messages, and the wording an agency chose is
the wording you should see. So getting alerts in your language is a question of
configuring the *source*, not the card.

Three cases, in the order worth trying.

## 1. Your provider has a language setting

Most European and Canadian sources publish the same alert in several languages and let
you pick one. This is where nearly everyone lands.

| Provider | Where to set it | Notes |
|----------|-----------------|-------|
| **MeteoAlarm** | `language:` in the YAML platform config. Defaults to `en` | See the caveat below |
| **CAP Alerts** | Integration options | ECCC: `auto` / `en-CA` / `fr-CA`. MeteoAlarm: two-letter prefix (`nl`, `de`, `fr`). WMO: `auto` or any tag the source publishes, e.g. `zh-Hans` |
| **ECCC** (`env_canada`) | Chosen when you add the integration | Station and language together form the entry's unique key, so switching languages means adding a second entry |
| **PirateWeather** | Integration options, defaults to `en` | Applies to PirateWeather's own summary text. Alert bodies are relayed from the issuing agency and may stay in the original language |

MeteoAlarm example — the language goes on the platform, not the card:

```yaml
binary_sensor:
  - platform: meteoalarm
    country: "netherlands"
    province: "Zuid-Holland"
    language: "nl"
```

The two-letter code is enough. The upstream library matches it as a prefix, so `nl`
finds the feed's `nl-NL` block and `de` finds `de-DE`.

::: warning MeteoAlarm titles depend on your national service
Setting `language:` reliably localizes the **headline** and **description**. The
**title** comes from the CAP `event` field, and MeteoAlarm does not translate that —
each member service supplies its own.

Most do. GeoSphere Austria sends `Hitzewarnung`, Météo-France sends
`Vigilance jaune canicule`, AEMET sends `Aviso de temperaturas máximas de nivel naranja`.
A few send nothing, and those alerts fall back to MeteoAlarm's generated English string
(`Moderate high-temperature warning`) even inside an otherwise fully translated block.
KNMI in the Netherlands is one of them.

There is no card-side fix for this. Overriding the `event` field would discard the good
titles from every service that does the work, to patch the few that don't. If your
service is affected, the useful move is to ask them to populate the CAP `<event>`
element in their own language.
:::

## 2. Your provider publishes one language, full stop

Some sources have no language option because they only ever issue in one:

| Provider | Language | |
|----------|----------|---|
| **DWD** | German | No option |
| **NINA** | German | No option |
| **NWS** | English | No option |
| **BoM** | English | No option |
| **NSW RFS** | English | No option |
| **MeteoSwiss** | English | The integration requests English and does not expose a setting, even though the upstream API offers `de`, `fr` and `it` |

For the first five there is nothing to configure and nothing upstream to ask for — a
German-language NWS feed does not exist. MeteoSwiss is different: the data is published
in four languages and only the integration's hardcoded request stands in the way, so
that one is worth raising with the integration author.

## 3. Translate it yourself

If you have landed here, your provider issues in one language and it isn't yours. The
card can still display translated text, but you have to produce it.

The approach: build a **template sensor that mimics a supported provider's attribute
shape**, fill it from an automation that runs the original text through a translation
service, and point the card at that instead of the real entity.

The MeteoAlarm shape is the easiest target, being flat:

```yaml
template:
  - trigger:
      - trigger: state
        entity_id: binary_sensor.my_real_alert_source
    binary_sensor:
      - name: "Translated weather alert"
        state: "{{ trigger.to_state.state }}"
        attributes:
          event: "{{ state_attr('input_text.translated_event', 'value') }}"
          headline: "{{ state_attr('input_text.translated_headline', 'value') }}"
          description: "{{ state_attr('input_text.translated_description', 'value') }}"
          awareness_type: "{{ state_attr('binary_sensor.my_real_alert_source', 'awareness_type') }}"
          awareness_level: "{{ state_attr('binary_sensor.my_real_alert_source', 'awareness_level') }}"
          onset: "{{ state_attr('binary_sensor.my_real_alert_source', 'onset') }}"
          expires: "{{ state_attr('binary_sensor.my_real_alert_source', 'expires') }}"
          senderName: "{{ state_attr('binary_sensor.my_real_alert_source', 'senderName') }}"
```

Point the card at the mirror and name the provider explicitly, so nothing depends on
attribute-shape auto-detection:

```yaml
type: custom:weather-alerts-card
entity: binary_sensor.translated_weather_alert
provider: meteoalarm
```

Producing the translated strings is up to you. An automation calling a conversation
agent, or a `rest_command` against a translation API, both work. Keep the timing fields
as raw pass-throughs; only the human-readable fields need translating.

Three things to know before you build this.

**Machine translation of safety text carries real risk.** A mistranslated instruction is
worse than an untranslated one. Keep the original entity on the dashboard too, or at
minimum keep the source link enabled so the official wording is one tap away.

**Dismissals key off the alert text.** The card derives an alert's identity partly from
its event string. A translator that returns slightly different wording on a later run
produces a different identity, and an alert you dismissed can reappear as new. Cache
each translation and reuse it rather than re-translating on every state change.

**Nothing keeps the mirror honest.** If your automation fails, the template sensor holds
stale text while the real feed moves on. A card showing yesterday's all-clear during
today's storm is the failure mode to design against.

This path is unsupported. It works because the card accepts any entity matching a
provider's shape, not because there is machinery here for it.
