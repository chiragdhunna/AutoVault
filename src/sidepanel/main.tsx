import { render } from 'preact';
import { Sidepanel } from './Sidepanel';
import './sidepanel.css';

const root = document.getElementById('app');
if (root) render(<Sidepanel />, root);
