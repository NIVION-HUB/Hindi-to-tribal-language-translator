/**
 * Bhasha Setu - 3D Interactive Animated AI Co-Teacher
 * Native GLTF/Mixamo Animation Loader with Head Tracking
 */

(function(window) {
  'use strict';

  class Avatar3DEngine {
    constructor(options = {}) {
      this.containerId = options.containerId || 'heroAvatarStage';
      this.container = document.getElementById(this.containerId);
      
      if (!this.container) return;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(30, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
      this.camera.position.set(0, 1.4, 3.8); 
      
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.outputEncoding = 3001; 
      
      this.container.innerHTML = '';
      this.container.appendChild(this.renderer.domElement);
      
      this.clock = new THREE.Clock();
      this.mixer = null;
      
      // Tracking variables
      this.targetRotation = { x: 0, y: 0 };
      this.headBone = null;
      this.neckBone = null;
      this.spineBone = null;
      
      this.initLighting();
      this.loadModel();
      
      window.addEventListener('resize', this.onResize.bind(this));
      
      // Mouse movement tracker
      document.addEventListener('mousemove', (e) => {
        // Normalize mouse coordinates from -1 to 1
        const mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
        
        // Limit how far the head can turn
        this.targetRotation.x = mouseY * 0.4; // Look up/down
        this.targetRotation.y = mouseX * 0.6; // Look left/right
      });

      this.animate();
    }
    
    initLighting() {
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
      this.scene.add(ambientLight);
      
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
      dirLight.position.set(2, 5, 5);
      this.scene.add(dirLight);
    }
    
    loadModel() {
      const loader = new THREE.GLTFLoader();
      
      loader.load('Idle.glb', (gltf) => {
        const model = gltf.scene;
        
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const desiredHeight = 6.5; 
        const scale = desiredHeight / maxDim;
        
        model.scale.set(scale, scale, scale);
        
        // Push her up slightly
        model.position.x = -center.x * scale;
        model.position.y = (-center.y * scale) - 1.25; 
        model.position.z = -center.z * scale;
        
        this.scene.add(model);
        this.camera.lookAt(new THREE.Vector3(0, 1.0, 0));
        
        // Find the bones for tracking
        model.traverse((child) => {
          if (child.isBone) {
            const name = child.name.toLowerCase();
            // Works for Mixamo, VRoid, and generic models
            if (name === 'mixamorighead' || name === 'head' || name.includes('head')) {
              this.headBone = child;
            }
            if (name === 'mixamorigneck' || name === 'neck' || name.includes('neck')) {
              this.neckBone = child;
            }
            if (name === 'mixamorigspine2' || name === 'spine2' || name === 'chest') {
              this.spineBone = child;
            }
          }
        });
        
        if (gltf.animations && gltf.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(model);
            const idleAction = this.mixer.clipAction(gltf.animations[0]);
            idleAction.play();
        }
        
      }, undefined, (error) => {
        console.error("CRITICAL ERROR loading model:", error);
      });
    }
    
    onResize() {
      if (!this.container) return;
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
    
    animate() {
      requestAnimationFrame(this.animate.bind(this));
      const delta = this.clock.getDelta();
      
      // 1. Update the base idle animation first
      if (this.mixer) {
        this.mixer.update(delta);
      }
      
      // 2. Apply head tracking OVER the animation
      if (this.headBone) {
        // Smoothly interpolate current rotation to target rotation
        this.headBone.rotation.x = THREE.MathUtils.lerp(this.headBone.rotation.x, this.targetRotation.x, 0.08);
        this.headBone.rotation.y = THREE.MathUtils.lerp(this.headBone.rotation.y, this.targetRotation.y, 0.08);
      }
      
      // Move neck and spine slightly for more natural body tracking
      if (this.neckBone) {
        this.neckBone.rotation.x = THREE.MathUtils.lerp(this.neckBone.rotation.x, this.targetRotation.x * 0.5, 0.08);
        this.neckBone.rotation.y = THREE.MathUtils.lerp(this.neckBone.rotation.y, this.targetRotation.y * 0.5, 0.08);
      }
      if (this.spineBone) {
        this.spineBone.rotation.y = THREE.MathUtils.lerp(this.spineBone.rotation.y, this.targetRotation.y * 0.2, 0.05);
      }
      
      this.renderer.render(this.scene, this.camera);
    }
    
    triggerGesture() {}
    setLipSync() {}
    setEmotion() {}
    changeOutfit() {}
    toggleGlasses() {}
  }

  window.Avatar3DEngine = Avatar3DEngine;

})(window);
