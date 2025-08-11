const sounds = {
    notification: '/sounds/notification.mp3',
    // You can add more sounds here later, e.g., 'error', 'delete'
};

/**
 * Plays a sound if the browser allows it.
 * @param {string} soundName - The name of the sound to play (e.g., 'notification').
 */
export const playSound = (soundName) => {
    const soundSrc = sounds[soundName];
    if (soundSrc) {
        const audio = new Audio(soundSrc);
        audio.play().catch(error => {
            // This catch block prevents console errors if autoplay is blocked by the browser.
            console.warn(`Could not play sound "${soundName}":`, error.message);
        });
    }
};