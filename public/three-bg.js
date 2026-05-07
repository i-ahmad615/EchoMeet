// Three.js Background Animation
const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
script.onload = initThree;
document.head.appendChild(script);

function initThree() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('bg-canvas'), alpha: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Particle system
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 1500;
    const posArray = new Float32Array(particlesCount * 3);
    
    for (let i = 0; i < particlesCount * 3; i += 3) {
        posArray[i] = (Math.random() - 0.5) * 2000;
        posArray[i+1] = (Math.random() - 0.5) * 1000;
        posArray[i+2] = (Math.random() - 0.5) * 500;
    }
    
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.5,
        color: 0x667eea,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending
    });
    
    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);
    
    // Second particle system
    const particlesGeometry2 = new THREE.BufferGeometry();
    const posArray2 = new Float32Array(800 * 3);
    for (let i = 0; i < 800 * 3; i += 3) {
        posArray2[i] = (Math.random() - 0.5) * 1500;
        posArray2[i+1] = (Math.random() - 0.5) * 800;
        posArray2[i+2] = (Math.random() - 0.5) * 400;
    }
    particlesGeometry2.setAttribute('position', new THREE.BufferAttribute(posArray2, 3));
    const particlesMaterial2 = new THREE.PointsMaterial({
        size: 0.3,
        color: 0x764ba2,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
    });
    const particlesMesh2 = new THREE.Points(particlesGeometry2, particlesMaterial2);
    scene.add(particlesMesh2);
    
    camera.position.z = 300;
    
    let mouseX = 0, mouseY = 0;
    document.addEventListener('mousemove', (event) => {
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = (event.clientY / window.innerHeight) * 2 - 1;
    });
    
    function animate() {
        requestAnimationFrame(animate);
        
        particlesMesh.rotation.y += 0.0005;
        particlesMesh.rotation.x += 0.0003;
        particlesMesh2.rotation.y -= 0.0004;
        
        particlesMesh.rotation.x += mouseY * 0.0005;
        particlesMesh.rotation.y += mouseX * 0.0005;
        
        renderer.render(scene, camera);
    }
    
    animate();
    
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}