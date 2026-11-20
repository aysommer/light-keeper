/**
 * Плёночный шейдер: зерно, виньетка и лёгкое расхождение цветов по краям.
 * Сила зерна и расхождения растёт при испуге (`uScare`).
 */
export const FilmShader = {
  name: 'LightKeeperFilm',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uScare: { value: 0 },
    uGrain: { value: 0.05 },
    uVignette: { value: 0.35 },
    uAberration: { value: 0.0012 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uScare;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uAberration;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 37.0) * 43758.5453);
    }

    void main() {
      vec2 fromCenter = vUv - 0.5;
      float edge = dot(fromCenter, fromCenter);
      // Расхождение цветов сильнее к краям и при испуге.
      vec2 shift = fromCenter * edge * (uAberration + uScare * 0.006) * 8.0;
      vec4 color = texture2D(tDiffuse, vUv);
      color.r = texture2D(tDiffuse, vUv + shift).r;
      color.b = texture2D(tDiffuse, vUv - shift).b;
      // Виньетка.
      color.rgb *= 1.0 - smoothstep(0.12, 0.6, edge) * (uVignette + uScare * 0.25);
      // Зерно.
      float grain = (hash(vUv * 1000.0) - 0.5) * (uGrain + uScare * 0.06);
      color.rgb += grain;
      gl_FragColor = color;
    }
  `,
};
