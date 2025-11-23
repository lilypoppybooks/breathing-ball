/*
Name: Breathing Ball
Author: Felix Lahaie
Website: https://lily-and-poppy.com
Description: A desktop tool that minimizes all applications and guides a calm breathing exercise, helping you relax and focus.
*/

import GObject from 'gi://GObject';
import St from 'gi://St';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Breathing Ball');

        // Variables internes comme propriétés de la classe
        this.tube = null;
        this.ball = null;
        this.counterLabel = null;
        this.animationTimeout = null;
        this.fadeTimeout = null;
        this.colorAnim = 0;

        // Icone smiley
        this.add_child(new St.Icon({
            icon_name: 'face-smile-symbolic',
            style_class: 'system-status-icon',
        }));

        this.connect('button-press-event', () => {
            if (!this.ball && !this.counterLabel) {
                this._startCountdown();
            } else {
                this._stopBreathing();
            }
        });
    }

    _showDesktop() {
        const workspaceManager = global.workspace_manager;
        const activeWorkspace = workspaceManager.get_active_workspace();
        activeWorkspace.list_windows().forEach(win => { if (!win.skip_taskbar) win.minimize(); });
    }

    _startCountdown() {
        this._showDesktop();

        const screenWidth = Main.layoutManager.primaryMonitor.width;
        const screenHeight = Main.layoutManager.primaryMonitor.height;

        this.counterLabel = new St.Label({
            text: '3',
            style_class: 'countdown-label',
            opacity: 0,
        });
        this.counterLabel.set_position(screenWidth / 2 - 30, screenHeight / 2 - 50);
        Main.layoutManager.uiGroup.add_child(this.counterLabel);

        let count = 3;
        const fadeTime = 500;

        const showNext = () => {
            this.counterLabel.set_text(String(count));
            this.counterLabel.ease({ opacity: 255, duration: fadeTime, mode: Clutter.AnimationMode.EASE_IN_OUT });

            if (this.fadeTimeout) GLib.source_remove(this.fadeTimeout);
            this.fadeTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                this.counterLabel.ease({ opacity: 0, duration: fadeTime, mode: Clutter.AnimationMode.EASE_IN_OUT });
                count--;
                if (count > 0) GLib.timeout_add(GLib.PRIORITY_DEFAULT, fadeTime, showNext);
                else GLib.timeout_add(GLib.PRIORITY_DEFAULT, fadeTime, () => {
                    this.counterLabel.destroy();
                    this.counterLabel = null;
                    this._createBreathingTool();
                });
                return GLib.SOURCE_REMOVE;
            });
        };
        showNext();
    }

    _createBreathingTool() {
        const screenWidth = Main.layoutManager.primaryMonitor.width;
        const screenHeight = Main.layoutManager.primaryMonitor.height;

        const tubeWidth = 50;
        const tubeHeight = 300;
        const ballSize = 50;

        this.tube = new St.BoxLayout({ style_class: 'breath-tube', x_expand: false, y_expand: false });
        this.tube.set_position(screenWidth / 2 - tubeWidth / 2, screenHeight / 2 - tubeHeight / 2);

        this.ball = new St.BoxLayout({ style_class: 'breath-ball', width: ballSize, height: ballSize, x_expand: false, y_expand: false });
        const ballX = screenWidth / 2 - ballSize / 2 + 2;
        const startY = screenHeight / 2 + 2 + tubeHeight / 2 - ballSize - 1;
        const endY = screenHeight / 2 - tubeHeight / 2 + 2;

        this.ball.set_translation(ballX, startY, 0);
        Main.layoutManager.uiGroup.add_child(this.tube);
        Main.layoutManager.uiGroup.add_child(this.ball);

        // Fondue starter
        this.ball.set_opacity(0);
        this.tube.set_opacity(0);
        this.ball.ease({ opacity: 255, duration: 500, mode: Clutter.AnimationMode.EASE_IN_OUT });
        this.tube.ease({ opacity: 255, duration: 500, mode: Clutter.AnimationMode.EASE_IN_OUT });

        // Breathing animation
        const fps = 60;
        const frameTime = 1000 / fps;
        let counter = 0;

        const inspFrames = 5 * fps;       // 5 sec inhale
        const pauseTopFrames = 1 * fps;   // 1 sec pause top
        const expFrames = 5 * fps;        // 5 sec expiration
        const pauseBottomFrames = 1 * fps; // 1 sec pause down
        const totalFrames = inspFrames + pauseTopFrames + expFrames + pauseBottomFrames;

        if (this.animationTimeout) GLib.source_remove(this.animationTimeout);
        this.animationTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, frameTime, () => {
            let y, progress;

            if (counter < inspFrames) {
                progress = counter / inspFrames;
                progress = 0.5 - 0.5 * Math.cos(Math.PI * progress); // ease-in-out
                y = startY + (endY - startY) * progress;
                this.colorAnim = progress;
            } else if (counter < inspFrames + pauseTopFrames) {
                y = endY;
                this.colorAnim = 1;
            } else if (counter < inspFrames + pauseTopFrames + expFrames) {
                progress = (counter - inspFrames - pauseTopFrames) / expFrames;
                progress = 0.5 - 0.5 * Math.cos(Math.PI * progress); // ease-in-out
                y = endY + (startY - endY) * progress;
                this.colorAnim = 1 - progress;
            } else {
                y = startY;
                this.colorAnim = 0;
            }

            this.ball.set_translation(ballX, y, 0);

            const r = Math.round(255 * this.colorAnim + 79 * (1 - this.colorAnim));
            const g = Math.round(77 * this.colorAnim + 195 * (1 - this.colorAnim));
            const b = Math.round(77 * this.colorAnim + 247 * (1 - this.colorAnim));
            this.ball.set_style(`background-color: rgb(${r},${g},${b});`);

            counter = (counter + 1) % totalFrames;
            return true;
        });
    }

    _stopBreathing() {
        if (this.animationTimeout) GLib.source_remove(this.animationTimeout);
        this.animationTimeout = null;

        const fadeDuration = 500;
        if (this.ball) this.ball.ease({ opacity: 0, duration: fadeDuration, mode: Clutter.AnimationMode.EASE_IN_OUT });
        if (this.tube) this.tube.ease({ opacity: 0, duration: fadeDuration, mode: Clutter.AnimationMode.EASE_IN_OUT });

        if (this.fadeTimeout) GLib.source_remove(this.fadeTimeout);
        this.fadeTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, fadeDuration, () => {
            if (this.ball) { this.ball.destroy(); this.ball = null; }
            if (this.tube) { this.tube.destroy(); this.tube = null; }
            return GLib.SOURCE_REMOVE;
        });
    }

    destroy() {
        if (this.animationTimeout) GLib.source_remove(this.animationTimeout);
        if (this.fadeTimeout) GLib.source_remove(this.fadeTimeout);
        if (this.ball) this.ball.destroy();
        if (this.tube) this.tube.destroy();
        if (this.counterLabel) this.counterLabel.destroy();
        super.destroy();
    }
});

export default class BreathingBallExtension extends Extension {
    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    destroy() {
        if (this._indicator) this._indicator.destroy();
        super.destroy();
    }
}
