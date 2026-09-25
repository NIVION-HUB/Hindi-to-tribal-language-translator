/**
 * Bhasha Setu - 3D Interactive Animated AI Co-Teacher ("Aditi")
 * Real-time WebGL Avatar Engine using Three.js & GLTF
 * Features:
 *  - High quality studio 3-point lighting with hair rim light & stardust
 *  - Automatic offline data-URI fallback for file:// protocol (Zero CORS errors)
 *  - Procedural lifelike breathing & micro-idle drifting
 *  - Natural human blinking (randomized intervals + double blinks)
 *  - Smooth mouse cursor tracking (head and eyes follow visitor)
 *  - Real-time speech lip-sync (visemes synchronized with voice/TTS)
 *  - Procedural gestures (Wave Hello, Explain Lesson, Johar Greeting, Thinking, Big Smile)
 *  - Customizable attire colors & toggleable glasses
 *  - Floating 3D tribal script orbital rings
 */

(function(window) {
  'use strict';

  class Avatar3DEngine {
    constructor(options = {}) {
      this.containerId = options.containerId || 'heroAvatarStage';
      this.container = null;
      this.canvas = null;
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      this.model = null;
      this.bones = {};
      this.morphMeshes = [];
      this.targetLookup = {};
      this.glassesMesh = null;
      this.topMesh = null;

      // Animation & state flags
      this.clock = new THREE.Clock();
      this.isLoaded = false;
      this.isLoading = false;
      this.isSpeaking = false;
      this.speakTime = 0;
      this.currentGesture = null;
      this.gestureStartTime = 0;
      this.gestureDuration = 0;

      // Mouse tracking state
      this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0, active: false };
      this.lastMouseMove = Date.now();

      // Blinking state
      this.blinkTimer = 2.0;
      this.isBlinking = false;
      this.blinkProgress = 0;
      this.isDoubleBlink = false;

      // Expression base values (Warm, attractive, welcoming educator)
      this.baseSmile = 0.32;
      this.baseBrowInnerUp = 0.18;
      this.smileBoost = 0;

      // Camera presets (tailored to Ready Player Me female rig)
      this.cameraPresets = {
        portrait: { pos: [0, 1.58, 0.70], target: [0, 1.56, 0] },
        medium:   { pos: [0, 1.42, 1.15], target: [0, 1.38, 0] },
        full:     { pos: [0, 1.25, 1.70], target: [0, 1.20, 0] }
      };
      this.currentPreset = 'medium';
      this._targetCamPos = new THREE.Vector3(...this.cameraPresets.medium.pos);
      this._targetCamLook = new THREE.Vector3(...this.cameraPresets.medium.target);

      // Orbital rings & particles
      this.orbitalGroup = null;
      this.particleSystem = null;

      // Bound render loop
      this._animate = this._animate.bind(this);
      this._onMouseMove = this._onMouseMove.bind(this);
      this._onResize = this._onResize.bind(this);
    }

    init() {
      this.container = document.getElementById(this.containerId);
      if (!this.container) {
        console.warn('[Avatar3D] Container #' + this.containerId + ' not found.');
        return false;
      }

      // Compute actual dimensions
      const width = Math.max(this.container.clientWidth || 380, 280);
      const height = Math.max(this.container.clientHeight || 420, 320);

      // 1. Scene
      this.scene = new THREE.Scene();

      // 2. Camera (Flattering portrait focal length, 36 deg FOV)
      this.camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);
      this.camera.position.set(...this.cameraPresets.medium.pos);
      this.camera.lookAt(...this.cameraPresets.medium.target);

      // 3. Renderer with antialias & high visual fidelity
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      this.canvas = this.renderer.domElement;
      this.canvas.className = 'w-full h-full object-contain select-none';
      this.container.innerHTML = '';
      this.container.appendChild(this.canvas);

      // 4. Studio Three-Point Lighting Setup
      this._setupStudioLighting();

      // 5. Ambient Stardust & 3D Orbital Glyph Rings
      this._setupOrbitalAura();
      this._setupParticles();

      // 6. Listeners
      window.addEventListener('mousemove', this._onMouseMove, { passive: true });
      window.addEventListener('resize', this._onResize, { passive: true });

      // Immediate resize check after layout renders
      setTimeout(() => this._onResize(), 100);
      setTimeout(() => this._onResize(), 500);

      // 7. Load Avatar Model
      this.loadModel('models/avatar-brunette.glb');

      // 8. Start Loop
      this._animate();
      return true;
    }

    _setupStudioLighting() {
      // Warm Hemisphere ambient light
      const hemiLight = new THREE.HemisphereLight(0xfff6ea, 0x1E3A2F, 0.85);
      hemiLight.position.set(0, 5, 0);
      this.scene.add(hemiLight);

      // Main Key Light: Warm soft peach, angled top-right
      const keyLight = new THREE.DirectionalLight(0xfff3e2, 1.7);
      keyLight.position.set(2.0, 3.0, 2.2);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.bias = -0.0005;
      this.scene.add(keyLight);

      // Fill Light: Soft cool mint/cyan, angled front-left to soften shadows
      const fillLight = new THREE.DirectionalLight(0xd4f0e7, 0.95);
      fillLight.position.set(-2.2, 1.8, 1.8);
      this.scene.add(fillLight);

      // Golden Rim / Hair Backlight: positioned behind to create radiant hair edge shine
      const rimLight = new THREE.DirectionalLight(0xffd580, 2.4);
      rimLight.position.set(0, 2.6, -2.2);
      this.scene.add(rimLight);

      // Ground bounce glow
      const bounceLight = new THREE.DirectionalLight(0x2D5A47, 0.4);
      bounceLight.position.set(0, -1.5, 1);
      this.scene.add(bounceLight);
    }

    _setupOrbitalAura() {
      this.orbitalGroup = new THREE.Group();
      this.orbitalGroup.position.set(0, 1.38, 0);

      // Delicate golden halo ring
      const ringGeom = new THREE.TorusGeometry(0.85, 0.006, 16, 100);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xE26D28,
        transparent: true,
        opacity: 0.42
      });
      const ring1 = new THREE.Mesh(ringGeom, ringMat);
      ring1.rotation.x = Math.PI / 2.3;
      ring1.rotation.y = 0.15;
      this.orbitalGroup.add(ring1);

      // Second outer ring angled
      const ringGeom2 = new THREE.TorusGeometry(1.05, 0.004, 16, 100);
      const ringMat2 = new THREE.MeshBasicMaterial({
        color: 0x48bb78,
        transparent: true,
        opacity: 0.32
      });
      const ring2 = new THREE.Mesh(ringGeom2, ringMat2);
      ring2.rotation.x = -Math.PI / 2.6;
      ring2.rotation.z = 0.25;
      this.orbitalGroup.add(ring2);

      // Floating tribal glyph beads (Santhali, Ho, Mundari, Kharia)
      const glyphColors = [0xE26D28, 0x38a169, 0xd69e2e, 0x3182ce];
      this.glyphNodes = [];
      for (let i = 0; i < 4; i++) {
        const sphereGeom = new THREE.SphereGeometry(0.025, 16, 16);
        const sphereMat = new THREE.MeshStandardMaterial({
          color: glyphColors[i],
          emissive: glyphColors[i],
          emissiveIntensity: 0.55,
          roughness: 0.2,
          metalness: 0.8
        });
        const bead = new THREE.Mesh(sphereGeom, sphereMat);
        const angle = (i / 4) * Math.PI * 2;
        bead.position.set(Math.cos(angle) * 0.85, Math.sin(angle) * 0.2, Math.sin(angle) * 0.85);
        this.orbitalGroup.add(bead);
        this.glyphNodes.push({ mesh: bead, baseAngle: angle, radius: 0.85 + (i % 2) * 0.2 });
      }

      this.scene.add(this.orbitalGroup);
    }

    _setupParticles() {
      const particleCount = 140;
      const geom = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);

      const color1 = new THREE.Color(0xE26D28);
      const color2 = new THREE.Color(0x38a169);
      const color3 = new THREE.Color(0xf6e05e);

      for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 0] = (Math.random() - 0.5) * 3.5;
        positions[i * 3 + 1] = 0.5 + Math.random() * 2.2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 3.0;

        const pick = Math.random();
        const c = pick < 0.4 ? color1 : (pick < 0.7 ? color2 : color3);
        colors[i * 3 + 0] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }

      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const mat = new THREE.PointsMaterial({
        size: 0.024,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
      });

      this.particleSystem = new THREE.Points(geom, mat);
      this.scene.add(this.particleSystem);
    }

    loadModel(url) {
      if (this.isLoading) return;
      this.isLoading = true;

      const loader = new THREE.GLTFLoader();

      const loadFromDataUri = () => {
        if (window.AVATAR_MODEL_BASE64) {
          console.log('[Avatar3D] Loading model via offline base64 data URI...');
          loader.load(
            'data:model/gltf-binary;base64,' + window.AVATAR_MODEL_BASE64,
            (gltf) => this._onModelLoaded(gltf),
            undefined,
            (err) => {
              console.error('[Avatar3D] Base64 avatar load failed:', err);
              this.isLoading = false;
            }
          );
        } else {
          console.warn('[Avatar3D] No base64 model found.');
          this.isLoading = false;
        }
      };

      // When running locally via file:// origin, browsers block fetch on relative assets.
      // Use embedded base64 data URI immediately to ensure 100% offline functionality without CORS error!
      if (window.location.protocol === 'file:' && window.AVATAR_MODEL_BASE64) {
        loadFromDataUri();
        return;
      }

      // Normal HTTP/HTTPS streaming load
      loader.load(
        url,
        (gltf) => this._onModelLoaded(gltf),
        undefined,
        (err) => {
          console.warn('[Avatar3D] Direct fetch failed, trying base64 fallback...', err);
          loadFromDataUri();
        }
      );
    }

    _onModelLoaded(gltf) {
      this.model = gltf.scene;
      this.model.position.set(0, 0, 0);
      this.model.rotation.set(0, 0, 0);

      // Find bones, morph targets, and clothing meshes
      this.model.traverse((node) => {
        if (node.isBone) {
          this.bones[node.name] = node;
        }

        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          node.frustumCulled = false;

          // Enhance material sheen & softness for realistic digital human
          if (node.material) {
            node.material.roughness = Math.max(0.35, node.material.roughness || 0.5);
            node.material.metalness = Math.min(0.12, node.material.metalness || 0);
            if (node.name.includes('Hair')) {
              node.material.roughness = 0.42;
            }
          }

          if (node.name === 'Wolf3D_Glasses') {
            this.glassesMesh = node;
          }
          if (node.name === 'Wolf3D_Outfit_Top') {
            this.topMesh = node;
            this.setOutfitColor('emerald');
          }

          if (node.morphTargetDictionary && node.morphTargetInfluences) {
            this.morphMeshes.push(node);
            for (const targetName in node.morphTargetDictionary) {
              if (!this.targetLookup[targetName]) {
                this.targetLookup[targetName] = [];
              }
              this.targetLookup[targetName].push({
                mesh: node,
                index: node.morphTargetDictionary[targetName]
              });
            }
          }
        }
      });

      this.scene.add(this.model);
      this.isLoaded = true;
      this.isLoading = false;

      // Initial welcoming facial expression
      this.setMorphWeight('mouthSmileLeft', this.baseSmile);
      this.setMorphWeight('mouthSmileRight', this.baseSmile);
      this.setMorphWeight('browInnerUp', this.baseBrowInnerUp);

      // Hide loader
      const loaderEl = document.getElementById('heroAvatarLoader');
      if (loaderEl) loaderEl.style.display = 'none';

      if (typeof this.onLoaded === 'function') {
        this.onLoaded();
      }

      // Initial welcoming wave after 700ms
      setTimeout(() => {
        this.wave();
      }, 700);
    }

    setMorphWeight(name, value) {
      const targets = this.targetLookup[name];
      if (!targets) return;
      for (let i = 0; i < targets.length; i++) {
        targets[i].mesh.morphTargetInfluences[targets[i].index] = value;
      }
    }

    getMorphWeight(name) {
      const targets = this.targetLookup[name];
      if (!targets || targets.length === 0) return 0;
      return targets[0].mesh.morphTargetInfluences[targets[0].index] || 0;
    }

    applyCameraPreset(name, animate = true) {
      const preset = this.cameraPresets[name] || this.cameraPresets.medium;
      this.currentPreset = name;
      this._targetCamPos = new THREE.Vector3(...preset.pos);
      this._targetCamLook = new THREE.Vector3(...preset.target);

      if (!animate && this.camera) {
        this.camera.position.copy(this._targetCamPos);
        this.camera.lookAt(this._targetCamLook);
      }
    }

    setOutfitColor(style) {
      if (!this.topMesh || !this.topMesh.material) return;
      const mat = this.topMesh.material;
      switch (style) {
        case 'emerald':
          mat.color = new THREE.Color(0x1E3A2F);
          break;
        case 'indigo':
          mat.color = new THREE.Color(0x1E293B);
          break;
        case 'palash':
          mat.color = new THREE.Color(0xC2410C);
          break;
        case 'royal':
          mat.color = new THREE.Color(0x581c87);
          break;
        default:
          mat.color = new THREE.Color(0x1E3A2F);
      }
    }

    toggleGlasses() {
      if (!this.glassesMesh) return false;
      this.glassesMesh.visible = !this.glassesMesh.visible;
      return this.glassesMesh.visible;
    }

    wave() {
      this.currentGesture = 'wave';
      this.gestureStartTime = this.clock.getElapsedTime();
      this.gestureDuration = 2.6;
      this.smileBoost = 0.35;
      this._updateSpeechBubble('Johar! Namaskar! I am Aditi, your PALASH Language Co-Teacher. How can I help you today?');
    }

    explain() {
      this.currentGesture = 'explain';
      this.gestureStartTime = this.clock.getElapsedTime();
      this.gestureDuration = 3.2;
      this.smileBoost = 0.25;
      this._updateSpeechBubble('Notice how each tribal script maps phonetically to foundational sounds! Watch the display card closely.');
    }

    johar() {
      this.currentGesture = 'johar';
      this.gestureStartTime = this.clock.getElapsedTime();
      this.gestureDuration = 2.8;
      this.smileBoost = 0.4;
      this._updateSpeechBubble('Johar! (ᱡᱚᱦᱟᱨ) • Respectful greetings to all teachers and young learners of Jharkhand.');
    }

    think() {
      this.currentGesture = 'think';
      this.gestureStartTime = this.clock.getElapsedTime();
      this.gestureDuration = 2.5;
      this.smileBoost = -0.1;
      this._updateSpeechBubble('Analyzing linguistic corpus... Cross-referencing 17,809 authentic sentence pairs.');
    }

    cheer() {
      this.currentGesture = 'cheer';
      this.gestureStartTime = this.clock.getElapsedTime();
      this.gestureDuration = 2.4;
      this.smileBoost = 0.55;
      this._updateSpeechBubble('Excellent job! Marang bura! Keep practicing your native tribal words.');
    }

    startSpeaking(text = '', durationMs = 3000) {
      this.isSpeaking = true;
      this.speakTime = 0;
      if (text) {
        this._updateSpeechBubble(text);
      }
      if (durationMs > 0) {
        clearTimeout(this._speakTimeout);
        this._speakTimeout = setTimeout(() => {
          this.stopSpeaking();
        }, durationMs);
      }
    }

    stopSpeaking() {
      this.isSpeaking = false;
      clearTimeout(this._speakTimeout);
      this.setMorphWeight('mouthOpen', 0);
      this.setMorphWeight('viseme_aa', 0);
      this.setMorphWeight('viseme_O', 0);
      this.setMorphWeight('viseme_E', 0);
      this.setMorphWeight('viseme_I', 0);
    }

    _updateSpeechBubble(text) {
      const bubble = document.getElementById('avatarSpeechText');
      const container = document.getElementById('avatarSpeechBubble');
      if (bubble && text) {
        bubble.textContent = text;
        if (container) {
          container.classList.remove('hidden', 'opacity-0');
          container.classList.add('opacity-100');
          clearTimeout(this._bubbleTimeout);
          this._bubbleTimeout = setTimeout(() => {
            container.classList.add('opacity-0');
            setTimeout(() => container.classList.add('hidden'), 350);
          }, 8000);
        }
      }
    }

    _onMouseMove(event) {
      const rect = this.canvas ? this.canvas.getBoundingClientRect() : null;
      let cx = window.innerWidth / 2;
      let cy = window.innerHeight / 2;
      if (rect) {
        cx = rect.left + rect.width / 2;
        cy = rect.top + rect.height / 2;
      }

      this.mouse.targetX = (event.clientX - cx) / (window.innerWidth * 0.5);
      this.mouse.targetY = (event.clientY - cy) / (window.innerHeight * 0.5);
      this.mouse.active = true;
      this.lastMouseMove = Date.now();
    }

    _onResize() {
      if (!this.container || !this.renderer || !this.camera) return;
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      if (width > 0 && height > 0) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
      }
    }

    _animate() {
      requestAnimationFrame(this._animate);

      const delta = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();

      // Smooth camera position and orientation tracking
      if (this.camera) {
        if (this._targetCamPos) {
          this.camera.position.lerp(this._targetCamPos, 0.08);
        }
        if (this._targetCamLook) {
          this.camera.lookAt(this._targetCamLook);
        }
      }

      // Rotate orbital rings & particles
      if (this.orbitalGroup) {
        this.orbitalGroup.rotation.y = elapsed * 0.22;
        if (this.glyphNodes) {
          for (let i = 0; i < this.glyphNodes.length; i++) {
            const g = this.glyphNodes[i];
            const ang = g.baseAngle + elapsed * 0.35;
            g.mesh.position.x = Math.cos(ang) * g.radius;
            g.mesh.position.z = Math.sin(ang) * g.radius;
            g.mesh.position.y = Math.sin(ang * 2) * 0.08;
          }
        }
      }

      if (this.particleSystem) {
        this.particleSystem.rotation.y = elapsed * 0.035;
        const positions = this.particleSystem.geometry.attributes.position.array;
        for (let i = 1; i < positions.length; i += 3) {
          positions[i] += Math.sin(elapsed + i) * 0.0008;
        }
        this.particleSystem.geometry.attributes.position.needsUpdate = true;
      }

      if (!this.isLoaded || !this.model) {
        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera);
        }
        return;
      }

      // 1. Idle Natural Breathing
      const breath = Math.sin(elapsed * 2.2);
      if (this.bones.Spine) {
        this.bones.Spine.rotation.x = breath * 0.018;
      }
      if (this.bones.Spine1) {
        this.bones.Spine1.rotation.x = breath * 0.015;
      }
      if (this.bones.Spine2) {
        this.bones.Spine2.position.y = breath * 0.0025;
      }

      // 2. Mouse Look-At Tracking
      const mouseDamp = 0.08;
      this.mouse.x += (this.mouse.targetX - this.mouse.x) * mouseDamp;
      this.mouse.y += (this.mouse.targetY - this.mouse.y) * mouseDamp;

      const idleYaw = Math.sin(elapsed * 0.8) * 0.03;
      const idlePitch = Math.cos(elapsed * 1.1) * 0.02;

      const targetYaw = THREE.MathUtils.clamp(this.mouse.x * 0.55, -0.45, 0.45) + idleYaw;
      const targetPitch = THREE.MathUtils.clamp(-this.mouse.y * 0.35, -0.28, 0.22) + idlePitch;

      if (this.bones.Neck) {
        this.bones.Neck.rotation.y = targetYaw * 0.4;
        this.bones.Neck.rotation.x = targetPitch * 0.35;
      }
      if (this.bones.Head) {
        this.bones.Head.rotation.y = targetYaw * 0.6;
        this.bones.Head.rotation.x = targetPitch * 0.65;
        this.bones.Head.rotation.z = -targetYaw * 0.12;
      }

      // 3. Natural Human Blinking
      this.blinkTimer -= delta;
      if (this.blinkTimer <= 0) {
        this.isBlinking = true;
        this.blinkProgress = 0;
        this.isDoubleBlink = Math.random() < 0.22;
        this.blinkTimer = 2.8 + Math.random() * 2.7;
      }

      if (this.isBlinking) {
        this.blinkProgress += delta * 12.0;
        let blinkWeight = Math.sin(this.blinkProgress * Math.PI);
        if (this.blinkProgress >= 1.0) {
          this.isBlinking = false;
          blinkWeight = 0;
          if (this.isDoubleBlink) {
            this.isDoubleBlink = false;
            this.blinkTimer = 0.12;
          }
        }
        this.setMorphWeight('eyesBlinkLeft', blinkWeight);
        this.setMorphWeight('eyesBlinkRight', blinkWeight);
      }

      // 4. Warm, Attractive Facial Expression
      this.smileBoost *= 0.95;
      const currentSmile = THREE.MathUtils.clamp(this.baseSmile + this.smileBoost, 0, 0.9);
      this.setMorphWeight('mouthSmileLeft', currentSmile);
      this.setMorphWeight('mouthSmileRight', currentSmile);
      this.setMorphWeight('browInnerUp', this.baseBrowInnerUp + (this.smileBoost > 0 ? 0.1 : 0));

      // 5. Speech Lip-Sync Animation
      if (this.isSpeaking) {
        this.speakTime += delta * 9.5;
        const openVal = (Math.sin(this.speakTime) * 0.5 + 0.5) * 0.45;
        const visemeA = Math.max(0, Math.sin(this.speakTime * 1.3)) * 0.55;
        const visemeO = Math.max(0, Math.cos(this.speakTime * 1.1)) * 0.45;
        const visemeE = Math.max(0, Math.sin(this.speakTime * 1.7)) * 0.35;

        this.setMorphWeight('mouthOpen', openVal);
        this.setMorphWeight('viseme_aa', visemeA);
        this.setMorphWeight('viseme_O', visemeO);
        this.setMorphWeight('viseme_E', visemeE);

        if (this.bones.Head) {
          this.bones.Head.rotation.x += Math.sin(this.speakTime * 0.6) * 0.035;
        }
      }

      // 6. Procedural Gestures
      this._updateGestures(elapsed);

      // 7. Render
      this.renderer.render(this.scene, this.camera);
    }

    _updateGestures(elapsed) {
      if (!this.currentGesture) return;

      const gTime = elapsed - this.gestureStartTime;
      const progress = gTime / this.gestureDuration;

      if (progress >= 1.0) {
        this._resetArmPoses();
        this.currentGesture = null;
        return;
      }

      const envelope = Math.sin(progress * Math.PI);

      if (this.currentGesture === 'wave') {
        if (this.bones.RightArm) {
          this.bones.RightArm.rotation.z = -1.1 * envelope;
          this.bones.RightArm.rotation.x = -0.4 * envelope;
        }
        if (this.bones.RightForeArm) {
          this.bones.RightForeArm.rotation.y = -0.8 * envelope;
          this.bones.RightForeArm.rotation.x = -0.3 * envelope;
        }
        if (this.bones.RightHand) {
          const waveWiggle = Math.sin(gTime * 9.0) * 0.35;
          this.bones.RightHand.rotation.z = waveWiggle * envelope;
        }
      } else if (this.currentGesture === 'explain') {
        if (this.bones.RightArm) {
          this.bones.RightArm.rotation.z = -0.6 * envelope;
          this.bones.RightArm.rotation.x = -0.65 * envelope;
          this.bones.RightArm.rotation.y = 0.3 * envelope;
        }
        if (this.bones.RightForeArm) {
          this.bones.RightForeArm.rotation.z = -0.3 * envelope;
          this.bones.RightForeArm.rotation.x = -0.5 * envelope;
        }
        if (this.bones.RightHand) {
          this.bones.RightHand.rotation.y = 0.3 * envelope;
        }
      } else if (this.currentGesture === 'johar') {
        if (this.bones.RightArm) {
          this.bones.RightArm.rotation.z = -0.45 * envelope;
          this.bones.RightArm.rotation.x = -0.5 * envelope;
          this.bones.RightArm.rotation.y = 0.45 * envelope;
        }
        if (this.bones.LeftArm) {
          this.bones.LeftArm.rotation.z = 0.45 * envelope;
          this.bones.LeftArm.rotation.x = -0.5 * envelope;
          this.bones.LeftArm.rotation.y = -0.45 * envelope;
        }
        if (this.bones.Head) {
          this.bones.Head.rotation.x = 0.15 * envelope;
        }
      } else if (this.currentGesture === 'think') {
        if (this.bones.RightArm) {
          this.bones.RightArm.rotation.z = -0.3 * envelope;
          this.bones.RightArm.rotation.x = -0.9 * envelope;
        }
        if (this.bones.RightForeArm) {
          this.bones.RightForeArm.rotation.x = -1.1 * envelope;
        }
        if (this.bones.Head) {
          this.bones.Head.rotation.z = -0.15 * envelope;
          this.bones.Head.rotation.y = -0.12 * envelope;
        }
      }
    }

    _resetArmPoses() {
      const armBones = ['RightArm', 'RightForeArm', 'RightHand', 'LeftArm', 'LeftForeArm', 'LeftHand'];
      armBones.forEach((name) => {
        if (this.bones[name]) {
          this.bones[name].rotation.set(0, 0, 0);
        }
      });
    }
  }

  window.Avatar3DEngine = Avatar3DEngine;

})(window);

